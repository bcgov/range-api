import config from '../src/config/index.js';
import { PLAN_EXTENSION_STATUS, SYSTEM_USER_ID } from '../src/constants.js';
import DataManager from '../src/libs/db2/index.js';
import { runAuditedBackgroundJob, writeDomainAudit } from '../src/libs/audit.js';
import { changeAuditMetadata, changedValues, diffFields, hasChanges } from '../src/libs/fieldChanges.js';
import {
  updateAgreementExemptions,
  sendAgreementExemptionStatusEmails,
} from '../src/router/helpers/AgreementExemptionHelper.js';
import { reconcilePlanExtensionVoters } from '../src/router/helpers/PlanExtensionHelper.js';
import NotificationHelper from '../src/router/helpers/NotificationHelper.js';
import { fileURLToPath } from 'url';

const dm = new (DataManager as any)(config);

const { db, Plan, PlanExtensionRequests, User } = dm;

const activateReplacementPlans = async (trx: any) => {
  const results = await trx
    .selectFrom(Plan.table)
    .selectAll()
    .where('plan_start_date', '<=', new Date())
    .where('extension_status', '=', PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN)
    .execute();
  for (const result of results) {
    await Plan.update(
      trx,
      { id: result.id },
      {
        extension_status: PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN,
      },
    );
    await writeDomainAudit(trx, {
      userId: SYSTEM_USER_ID,
      method: 'SYSTEM',
      path: 'background_job.plan_extension_exemption',
      action: 'plan.updated',
      entityType: 'plan',
      entityId: result.id,
      agreementId: result.agreement_id,
      metadata: {
        field: 'extension_status',
        to: PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN,
      },
    });

    await Plan.update(
      trx,
      { id: result.replacement_of },
      {
        extension_status: PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
      },
    );
    await writeDomainAudit(trx, {
      userId: SYSTEM_USER_ID,
      method: 'SYSTEM',
      path: 'background_job.plan_extension_exemption',
      action: 'plan.updated',
      entityType: 'plan',
      entityId: result.replacement_of,
      agreementId: result.agreement_id,
      metadata: {
        field: 'extension_status',
        to: PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
      },
    });
  }
};

const RETIRED_PLAN_STATUS_ID = 25;
const EXPIRED_PLAN_STATUS_ID = 26;

const processExpiredPlans = async (trx: any) => {
  const results = await trx.selectFrom(Plan.table).selectAll().where('plan_end_date', '<', new Date()).execute();
  for (const result of results) {
    if (
      result.status_id === EXPIRED_PLAN_STATUS_ID ||
      // The import job retires plans whose agreement is no longer in FTA; keep them retired
      // rather than flipping them to expired on every run.
      result.status_id === RETIRED_PLAN_STATUS_ID ||
      result.extension_status === PLAN_EXTENSION_STATUS.AWAITING_EXTENSION ||
      (result.extension_status === PLAN_EXTENSION_STATUS.AWAITING_VOTES &&
        result.extension_received_votes === result.extension_required_votes)
    )
      continue;
    await Plan.update(
      trx,
      { id: result.id },
      {
        status_id: EXPIRED_PLAN_STATUS_ID,
      },
    );
    await writeDomainAudit(trx, {
      userId: SYSTEM_USER_ID,
      method: 'SYSTEM',
      path: 'background_job.plan_extension_exemption',
      action: 'plan.updated',
      entityType: 'plan',
      entityId: result.id,
      agreementId: result.agreement_id,
      metadata: {
        field: 'status_id',
        from: result.status_id,
        to: EXPIRED_PLAN_STATUS_ID,
      },
    });
  }
};

const main = async () => {
  try {
    await runAuditedBackgroundJob(db, 'plan_extension_exemption', async () => {
      await db.transaction().execute(async (trx: any) => {
        const systemUser = await User.findById(trx, SYSTEM_USER_ID);
        if (!systemUser) {
          throw new Error('System user not found. Please ensure a user with SYSTEM_USER_ID exists.');
        }

        const currentDate = new Date();
        const oneYearLater = new Date();
        oneYearLater.setMonth(currentDate.getMonth() + 12);
        const expiringPlans = await Plan.fetchExpiringPlans(trx, currentDate, oneYearLater, 'plan.id');
        const planClientIds: Record<string, Set<string>> = {};
        for (const expiringPlan of expiringPlans) {
          if (!expiringPlan.clientId) continue;
          console.log(`Processing ${expiringPlan.planId}`);
          try {
            const existingRequest = await PlanExtensionRequests.findOne(trx, {
              plan_id: expiringPlan.planId,
              client_id: expiringPlan.clientId,
            });
            if (!existingRequest) {
              await PlanExtensionRequests.create(trx, {
                planId: expiringPlan.planId,
                clientId: expiringPlan.clientId,
                userId: expiringPlan.userId,
                email: expiringPlan.email,
              });
              if (expiringPlan.email) {
                await NotificationHelper.sendEmail(db, [expiringPlan.email], 'Request Plan Extension Votes', {
                  '{agreementId}': expiringPlan.agreementId,
                });
              }
            }
            if (!planClientIds[expiringPlan.planId]) planClientIds[expiringPlan.planId] = new Set();
            planClientIds[expiringPlan.planId].add(expiringPlan.clientId);
          } catch (error) {
            console.error(error);
          }
        }
        for (const planId of Object.keys(planClientIds)) {
          const plan = await Plan.findById(trx, planId);
          const changes = diffFields(plan || {}, {
            extensionStatus: PLAN_EXTENSION_STATUS.AWAITING_VOTES,
            extensionDate: null,
          });
          if (hasChanges(changes)) {
            await Plan.update(trx, { id: planId }, changedValues(changes));
          }
          const reconciliation = await reconcilePlanExtensionVoters(trx, planId, {
            userId: SYSTEM_USER_ID,
            method: 'SYSTEM',
            path: 'background_job.plan_extension_exemption',
          });
          if (!hasChanges(changes)) continue;

          const currentPlan = await Plan.findById(trx, planId);
          await writeDomainAudit(trx, {
            userId: SYSTEM_USER_ID,
            method: 'SYSTEM',
            path: 'background_job.plan_extension_exemption',
            action: 'plan.updated',
            entityType: 'plan',
            entityId: planId,
            agreementId: currentPlan?.agreementId || null,
            metadata: {
              ...changeAuditMetadata(changes),
              extensionRequiredVotes: currentPlan?.extensionRequiredVotes ?? null,
              extensionReceivedVotes: currentPlan?.extensionReceivedVotes ?? null,
              clientCount: planClientIds[planId].size,
              reconciliationStatus: reconciliation.status,
            },
          });
        }
        await processExpiredPlans(trx);
        await activateReplacementPlans(trx);
        const updates = await updateAgreementExemptions(trx, systemUser);
        for (const update of updates) {
          await writeDomainAudit(trx, {
            userId: SYSTEM_USER_ID,
            method: 'SYSTEM',
            path: 'background_job.plan_extension_exemption',
            action: 'agreement.updated',
            entityType: 'agreement',
            entityId: update.agreementId,
            agreementId: update.agreementId,
            metadata: {
              field: 'exemption_status',
              to: update.status,
            },
          });
        }
        await sendAgreementExemptionStatusEmails(trx, updates);
      });
    });
    console.log('Script completed successfully.');
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(0);
  }
  process.exit(0);
};

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main();
}

export { processExpiredPlans };
