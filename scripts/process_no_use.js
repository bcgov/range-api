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
  round,
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
      const pldAUMs = round(calcPldAUMs(totalAUMs, entry.pldPercent || 0), 1);
      const crownAUMWithDecimal = calcCrownAUMs(totalAUMs, pldAUMs);
      const crownAUMs = crownAUMWithDecimal > 0 && crownAUMWithDecimal < 1 ? 1 : round(crownAUMWithDecimal, 0);

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
 * Process NoUse functionality for a single agreement
 * @param {object} trx - The transaction object (optional, uses db if not provided)
 * @param {string} forestFileId - The forest file ID of the agreement to process
 * @param {number} agreementTypeId - The agreement type ID
 * @param {number} currentYear - The year to process (optional, defaults to current year)
 */
const processAgreementUsageStatus = async (
  trx = null,
  forestFileId,
  agreementTypeId,
  currentYear = getCurrentYear(),
) => {
  const dbConnection = trx || db;
  try {
    // Get usage data for current year
    const usage = await dbConnection('ref_usage')
      .select('total_annual_use')
      .where({
        agreement_id: forestFileId,
        year: currentYear.toString(),
      })
      .first();

    logger.info(`Processing agreement ${forestFileId} with usage: ${JSON.stringify(usage)}`);
    const allowedAnnualUsage = usage ? parseFloat(usage.total_annual_use) : null;
    let usageStatus = null; // Default to normal

    // Check if a plan exists for this agreement
    // Get all plans for this agreement, ordered by creation date
    const plans = await dbConnection('plan')
      .select('id', 'replacement_plan_id', 'extension_status', 'created_at')
      .where('agreement_id', forestFileId)
      .orderBy('created_at', 'asc');

    let plan = null;
    if (plans.length > 0) {
      // First try to find an active replacement plan
      plan = plans.find((p) => p.extension_status === 10);
      // If no active replacement plan, use the first created plan
      if (!plan) {
        plan = plans[0];
      }
    }
    let totalScheduleAUMs = 0;
    let scheduleExists = false;
    if (plan) {
      // Get current year schedule
      const schedule = await dbConnection('grazing_schedule')
        .select('id', 'year')
        .where('plan_id', plan.id)
        .andWhere('year', currentYear)
        .first();

      if (schedule) {
        scheduleExists = true;
        // Get schedule entries based on agreement type
        let scheduleEntries = [];

        if (agreementTypeId === 1 || agreementTypeId === 2) {
          // Grazing schedule
          scheduleEntries = await dbConnection('grazing_schedule_entry as gse')
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
        } else if (agreementTypeId === 3 || agreementTypeId === 4) {
          // Hay cutting schedule
          scheduleEntries = await dbConnection('haycutting_schedule_entry')
            .select('tonnes')
            .where('haycutting_schedule_id', schedule.id);
        }

        totalScheduleAUMs = calculateScheduleTotalAUMs({ scheduleEntries });
      }
    }

    // Calculate percentage use of total annual usage relative to scheduled AUMs
    let percentageUse = null;
    if (totalScheduleAUMs > 0) {
      percentageUse = ((totalScheduleAUMs / allowedAnnualUsage) * 100).toFixed(2);
    }
    if (allowedAnnualUsage === null) {
      usageStatus = null;
      percentageUse = null;
      logger.info(`Agreement ${forestFileId}: Percentage: ${percentageUse}%) usageStatus: ${usageStatus}`);
    } else if (allowedAnnualUsage === 0) {
      usageStatus = 0; // NoUse
      // For NoUse, percentage is 0
      if (plan && scheduleExists && totalScheduleAUMs > 0) {
        percentageUse = 999;
      } else {
        percentageUse = 0;
      }
      logger.info(
        `Agreement ${forestFileId}: NoUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    } else if (totalScheduleAUMs > allowedAnnualUsage) {
      // Check for OverUse condition (actual > scheduled)
      usageStatus = 1; // OverUse
      logger.info(
        `Agreement ${forestFileId}: OverUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    } else {
      logger.info(
        `Agreement ${forestFileId}: Normal usage (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    }

    // Update agreement with usage status, percentage use, and schedule status
    const updateData = { usage_status: usageStatus };
    updateData.percentage_use = percentageUse;
    updateData.has_current_schedule = scheduleExists ? 1 : 0;

    await dbConnection('agreement').where('forest_file_id', forestFileId).update(updateData);

    logger.info(`Successfully updated usage status for agreement ${forestFileId}`);
    return { forestFileId, usageStatus, percentageUse, scheduleExists };
  } catch (error) {
    logger.error(`Error processing agreement ${forestFileId}: ${error.message}`);
    throw error;
  }
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
      await processAgreementUsageStatus(null, agreement.forest_file_id, agreement.agreement_type_id, currentYear);
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

// Only run main() when this file is executed directly, not when imported as a module
// Check if this file is the main module being executed
if (require.main === module) {
  main();
}

export { processNoUseStatus, processAgreementUsageStatus };
