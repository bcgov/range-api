#!/usr/bin/env node

'use strict';

import { logger } from '@bcgov/nodejs-common-utils';
import DataManager from '../src/libs/db2/index.js';
import config from '../src/config/index.js';
import {
  calcTotalAUMs,
  calcPldAUMs,
  calcCrownAUMs,
  calcDateDiff,
  calcCrownTotalAUMs,
} from '../src/router/helpers/PDFHelper.js';

const dm = new DataManager(config);
const { db } = dm;

const calculateScheduleTotalAUMs = (schedule) => {
  if (!schedule || !schedule.scheduleEntries) {
    return 0;
  }
  // Process entries to add crownAUMs property like PDFHelper.js does
  const processedEntries = schedule.scheduleEntries.map((entry) => {
    // For grazing schedules: calculate with PLD considerations
    if (entry.livestockCount && entry.days && entry.auFactor) {
      const totalAUMs = calcTotalAUMs(entry.livestockCount, entry.days, entry.auFactor);
      const pldAUMs = calcPldAUMs(totalAUMs, entry.pldPercent || 0).toFixed(1);
      const crownAUMs = calcCrownAUMs(totalAUMs, pldAUMs);

      return {
        ...entry,
        totalAUMs,
        pldAUMs,
        crownAUMs,
      };
    }
    // For hay cutting schedules: AUM = tonnes (no PLD for hay cutting)
    if (entry.tonnes) {
      return {
        ...entry,
        crownAUMs: entry.tonnes,
      };
    }
    return {
      ...entry,
      crownAUMs: 0,
    };
  });

  // Use the PDFHelper.js function to calculate total Crown AUMs
  return calcCrownTotalAUMs(processedEntries);
};

/**
 * Get current year
 */
const getCurrentYear = () => {
  return new Date().getFullYear();
};

/**
 * Process NoUse functionality for all agreements
 */
const processNoUseStatus = async () => {
  const currentYear = getCurrentYear();
  logger.info(`Starting NoUse status processing for year ${currentYear}`);

  try {
    // Get all agreements
    const agreements = await db('agreement')
      .select('forest_file_id', 'agreement_type_id')
      .where('retired', false)
      .orderBy('forest_file_id');

    logger.info(`Processing ${agreements.length} agreements`);

    for (const agreement of agreements) {
      const forestFileId = agreement.forest_file_id;

      try {
        // Get usage data for current year
        const usage = await db('ref_usage')
          .select('total_annual_use')
          .where({
            agreement_id: forestFileId,
            year: currentYear.toString(),
          })
          .first();

        const totalAnnualUsage = usage ? parseFloat(usage.total_annual_use) || 0 : 0;

        let usageStatus = null; // Default to normal
        let overUseAmount = null; // Default to null

        // Check if a plan exists for this agreement
        const plan = await db('plan')
          .select('id')
          .where('agreement_id', forestFileId)
          .whereNull('replacement_plan_id')
          .orderBy('created_at', 'desc')
          .first();

        let totalScheduleAUMs = 0;

        if (plan) {
          // Get current year schedule
          const schedule = await db('grazing_schedule')
            .select('id', 'year')
            .where('plan_id', plan.id)
            .andWhere('year', currentYear)
            .first();

          if (schedule) {
            // Get schedule entries based on agreement type
            let scheduleEntries = [];

            if (agreement.agreement_type_id === 1 || agreement.agreement_type_id === 2) {
              // Grazing schedule
              scheduleEntries = await db('grazing_schedule_entry as gse')
                .select(
                  'gse.livestock_count',
                  'gse.date_in',
                  'gse.date_out',
                  'gse.pasture_id',
                  'rl.au_factor',
                  'p.pld_percent',
                )
                .leftJoin('ref_livestock as rl', 'gse.livestock_type_id', 'rl.id')
                .leftJoin('pasture as p', 'gse.pasture_id', 'p.id')
                .where('gse.grazing_schedule_id', schedule.id);

              // Calculate days and prepare entries with PLD considerations
              scheduleEntries = scheduleEntries.map((entry) => {
                const days = calcDateDiff(entry.date_out, entry.date_in, true);
                return {
                  ...entry,
                  days,
                  livestockCount: parseInt(entry.livestock_count) || 0,
                  auFactor: entry.au_factor || 0,
                  pldPercent: entry.pld_percent || 0,
                };
              });
            } else if (agreement.agreement_type_id === 3 || agreement.agreement_type_id === 4) {
              // Hay cutting schedule
              scheduleEntries = await db('haycutting_schedule_entry')
                .select('tonnes')
                .where('haycutting_schedule_id', schedule.id);
            }

            totalScheduleAUMs = calculateScheduleTotalAUMs({ scheduleEntries }).toFixed(1);
          }
        }

        // Calculate over use amount (positive = over use, negative = under use)
        overUseAmount = totalScheduleAUMs - totalAnnualUsage;

        // Determine usage status
        if (totalAnnualUsage === 0) {
          usageStatus = 0; // NoUse
          // For NoUse, over use is the full scheduled amount
          overUseAmount = totalScheduleAUMs;
          logger.info(
            `Agreement ${forestFileId}: NoUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${totalAnnualUsage}, Over: ${overUseAmount})`,
          );
        } else if (overUseAmount > 0) {
          // Check for OverUse condition (scheduled > actual)
          usageStatus = 1; // OverUse
          logger.info(
            `Agreement ${forestFileId}: OverUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${totalAnnualUsage}, Over: ${overUseAmount})`,
          );
        } else {
          logger.info(
            `Agreement ${forestFileId}: Normal usage (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${totalAnnualUsage})`,
          );
        }

        // Update agreement with usage status and over use amount
        const updateData = { usage_status: usageStatus };
        if (overUseAmount !== null) {
          updateData.over_use = overUseAmount;
        }

        await db('agreement').where('forest_file_id', forestFileId).update(updateData);
      } catch (error) {
        logger.error(`Error processing agreement ${forestFileId}: ${error.message}`);
      }
    }

    logger.info('NoUse status processing completed successfully');
  } catch (error) {
    logger.error(`Error in NoUse status processing: ${error.message}`);
    throw error;
  }
};

/**
 * Main execution
 */
const main = async () => {
  try {
    await processNoUseStatus();
    process.exit(0);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
};

main();

export { processNoUseStatus };
