import config from '../src/config/index.js';
import { PLAN_EXTENSION_STATUS, SYSTEM_USER_ID } from '../src/constants.js';
import DataManager from '../src/libs/db2/index.js';
import {
  updateAgreementExemptions,
  sendAgreementExemptionStatusEmails,
} from '../src/router/helpers/AgreementExemptionHelper.js';
import NotificationHelper from '../src/router/helpers/NotificationHelper.js';

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
    await Plan.update(
      trx,
      { id: result.replacement_of },
      {
        extension_status: PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
      },
    );
  }
};

const processExpiredPlans = async (trx: any) => {
  const results = await trx.selectFrom(Plan.table).selectAll().where('plan_end_date', '<', new Date()).execute();
  for (const result of results) {
    if (
      result.status_id === 26 ||
      result.extension_status === PLAN_EXTENSION_STATUS.AWAITING_EXTENSION ||
      (result.extension_status === PLAN_EXTENSION_STATUS.AWAITING_VOTES &&
        result.extension_received_votes === result.extension_required_votes)
    )
      continue;
    await Plan.update(
      trx,
      { id: result.id },
      {
        status_id: 26,
      },
    );
  }
};

const main = async () => {
  try {
    await db.transaction().execute(async (trx: any) => {
      const systemUser = await User.findById(trx, SYSTEM_USER_ID);
      if (!systemUser) {
        throw new Error('System user not found. Please ensure a user with SYSTEM_USER_ID exists.');
      }

      const currentDate = new Date();
      const oneYearLater = new Date();
      oneYearLater.setMonth(currentDate.getMonth() + 12);
      const expiringPlans = await Plan.fetchExpiringPlans(trx, currentDate, oneYearLater, 'plan.id');
      const requiredVotes: Record<string, number> = {};
      for (const expiringPlan of expiringPlans) {
        console.log(`Processing ${expiringPlan.planId}`);
        try {
          await PlanExtensionRequests.create(trx, {
            planId: expiringPlan.planId,
            clientId: expiringPlan.clientId,
            userId: expiringPlan.userId,
            email: expiringPlan.email,
          });
          if (requiredVotes[expiringPlan.planId] === undefined) requiredVotes[expiringPlan.planId] = 1;
          else requiredVotes[expiringPlan.planId] = requiredVotes[expiringPlan.planId] + 1;
          if (expiringPlan.email) {
            await NotificationHelper.sendEmail(db, [expiringPlan.email], 'Request Plan Extension Votes', {
              '{agreementId}': expiringPlan.agreementId,
            });
          }
        } catch (error) {
          console.error(error);
        }
      }
      for (const planId of Object.keys(requiredVotes)) {
        await Plan.update(
          trx,
          { id: planId },
          {
            extensionRequiredVotes: requiredVotes[planId],
            extensionReceivedVotes: 0,
            extensionStatus: PLAN_EXTENSION_STATUS.AWAITING_VOTES,
            extensionDate: null,
          },
        );
      }
      await processExpiredPlans(trx);
      await activateReplacementPlans(trx);
      const updates = await updateAgreementExemptions(trx, systemUser);
      await sendAgreementExemptionStatusEmails(trx, updates);
    });
    console.log('Script completed successfully.');
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(0);
  }
  process.exit(0);
};

main();
