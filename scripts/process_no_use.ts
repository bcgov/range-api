import { logger } from '../src/libs/bcgov-shim.js';
import DataManager from '../src/libs/db2/index.js';
import config from '../src/config/index.js';
import {
  calcTotalAUMs,
  calcPldAUMs,
  calcCrownAUMs,
  calcDateDiff,
  calcCrownTotalAUMs,
  round,
  roundUpPercentUse,
} from '../src/router/helpers/PDFHelper.js';

import { fileURLToPath } from 'url';

const dm = new (DataManager as any)(config);
const { db } = dm;

const calculateScheduleTotalAUMs = (schedule: any) => {
  if (!schedule || !schedule.scheduleEntries) {
    return 0;
  }
  const processedEntries = schedule.scheduleEntries.map((entry: any) => {
    if (entry.livestockCount && entry.days && entry.auFactor) {
      const totalAUMs = calcTotalAUMs(entry.livestockCount, entry.days, entry.auFactor);
      const pldAUMs = round(calcPldAUMs(totalAUMs, entry.pldPercent || 0), 0);
      const crownAUMWithDecimal = calcCrownAUMs(totalAUMs, pldAUMs);
      const crownAUMs = crownAUMWithDecimal > 0 && crownAUMWithDecimal < 1 ? 1 : round(crownAUMWithDecimal, 0);

      return {
        ...entry,
        totalAUMs,
        pldAUMs,
        crownAUMs,
      };
    }
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

  return calcCrownTotalAUMs(processedEntries);
};

const getCurrentYear = () => {
  return new Date().getFullYear();
};

const processAgreementUsageStatus = async (
  trx: any = null,
  forestFileId: string,
  agreementTypeId: number,
  currentYear: number = getCurrentYear(),
) => {
  const dbConnection = trx || db;
  try {
    const usage = await dbConnection
      .selectFrom('ref_usage')
      .select('total_annual_use')
      .where('agreement_id', '=', forestFileId)
      .where('year', '=', currentYear.toString())
      .executeTakeFirst();

    logger.info(`Processing agreement ${forestFileId} with usage: ${JSON.stringify(usage)}`);
    const allowedAnnualUsage = usage ? parseFloat(usage.total_annual_use) : null;
    let usageStatus: number | null = null;

    const plans = await dbConnection
      .selectFrom('plan')
      .select(['id', 'replacement_plan_id', 'extension_status', 'created_at'])
      .where('agreement_id', '=', forestFileId)
      .orderBy('created_at', 'asc')
      .execute();

    let plan = null;
    if (plans.length > 0) {
      plan = plans.find((p: any) => p.extension_status === 10);
      if (!plan) {
        plan = plans[0];
      }
    }
    let totalScheduleAUMs = 0;
    let scheduleExists = false;
    if (plan) {
      const schedule = await dbConnection
        .selectFrom('grazing_schedule')
        .select(['id', 'year'])
        .where('plan_id', '=', plan.id)
        .where('year', '=', currentYear)
        .executeTakeFirst();

      if (schedule) {
        scheduleExists = true;
        let scheduleEntries: any[] = [];

        if (agreementTypeId === 1 || agreementTypeId === 2) {
          scheduleEntries = await dbConnection
            .selectFrom('grazing_schedule_entry as gse')
            .select([
              'gse.livestock_count',
              'gse.date_in',
              'gse.date_out',
              'gse.pasture_id',
              'rl.au_factor',
              'p.pld_percent',
            ])
            .leftJoin('ref_livestock as rl', 'gse.livestock_type_id', 'rl.id')
            .leftJoin('pasture as p', 'gse.pasture_id', 'p.id')
            .where('gse.grazing_schedule_id', '=', schedule.id)
            .execute();

          scheduleEntries = scheduleEntries.map((entry: any) => {
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
          scheduleEntries = await dbConnection
            .selectFrom('haycutting_schedule_entry')
            .select('tonnes')
            .where('haycutting_schedule_id', '=', schedule.id)
            .execute();
        }

        totalScheduleAUMs = calculateScheduleTotalAUMs({ scheduleEntries });
      }
    }

    let percentageUse: number | null = null;
    if (totalScheduleAUMs > 0 && allowedAnnualUsage !== null) {
      percentageUse = roundUpPercentUse((totalScheduleAUMs / allowedAnnualUsage) * 100);
    }
    if (allowedAnnualUsage === null) {
      usageStatus = null;
      percentageUse = null;
      logger.info(`Agreement ${forestFileId}: Percentage: ${percentageUse}%) usageStatus: ${usageStatus}`);
    } else if (allowedAnnualUsage === 0) {
      usageStatus = 0;
      if (plan && scheduleExists && totalScheduleAUMs > 0) {
        percentageUse = 999;
      } else {
        percentageUse = 0;
      }
      logger.info(
        `Agreement ${forestFileId}: NoUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    } else if (totalScheduleAUMs > allowedAnnualUsage) {
      usageStatus = 1;
      logger.info(
        `Agreement ${forestFileId}: OverUse (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    } else {
      logger.info(
        `Agreement ${forestFileId}: Normal usage (Schedule AUMs: ${totalScheduleAUMs}, Usage: ${allowedAnnualUsage}, Percentage: ${percentageUse}%)`,
      );
    }

    const updateData: Record<string, any> = { usage_status: usageStatus };
    updateData.percentage_use = percentageUse;
    updateData.has_current_schedule = scheduleExists ? 1 : 0;

    await dbConnection.updateTable('agreement').set(updateData).where('forest_file_id', '=', forestFileId).execute();

    logger.info(`Successfully updated usage status for agreement ${forestFileId}`);
    return { forestFileId, usageStatus, percentageUse, scheduleExists };
  } catch (error: any) {
    logger.error(`Error processing agreement ${forestFileId}: ${error.message}`);
    throw error;
  }
};

const processNoUseStatus = async () => {
  const currentYear = getCurrentYear();
  logger.info(`Starting NoUse status processing for year ${currentYear}`);

  try {
    const agreements = await db
      .selectFrom('agreement')
      .select(['forest_file_id', 'agreement_type_id'])
      .where('retired', '=', false)
      .orderBy('forest_file_id', 'asc')
      .execute();

    logger.info(`Processing ${agreements.length} agreements`);

    for (const agreement of agreements) {
      await processAgreementUsageStatus(null, agreement.forest_file_id, agreement.agreement_type_id, currentYear);
    }

    logger.info('NoUse status processing completed successfully');
  } catch (error: any) {
    logger.error(`Error in NoUse status processing: ${error.message}`);
    throw error;
  }
};

const main = async () => {
  try {
    await processNoUseStatus();
    process.exit(0);
  } catch (error: any) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
};

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main();
}

export { processNoUseStatus, processAgreementUsageStatus };
