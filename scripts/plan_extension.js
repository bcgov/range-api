import { replace } from 'lodash';
import config from '../src/config';
import { PLAN_EXTENSION_STATUS } from '../src/constants';
import DataManager from '../src/libs/db2';
import EmailTemplate from '../src/libs/db2/model/emailtemplate';
import { Mailer } from '../src/libs/mailer';
import { substituteFields } from '../src/libs/utils';
import PlanStatusController from '../src/router/controllers_v1/PlanStatusController';

const dm = new DataManager(config);

const { db, Plan, PlanExtensionRequests } = dm;

const sendEmailToAgreementHolders = async (db, expiringPlan) => {
  const template = await EmailTemplate.findOne(db, {
    name: 'Request Plan Extension Votes',
  });
  const mailer = new Mailer();
  await mailer.sendEmail(
    [expiringPlan.email],
    template.fromEmail,
    substituteFields(template.subject, {
      '{agreementId}': expiringPlan.agreementId,
    }),
    substituteFields(template.body, {
      '{agreementId}': expiringPlan.agreementId,
    }),
    'html',
  );
};

const activateReplacementPlans = async (trx) => {
  const results = await trx
    .select()
    .from(Plan.table)
    .where('plan_start_date', '<=', new Date())
    .andWhere('extension_status', PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN);
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

const processExpiredPlans = async (trx) => {
  const results = await trx.select().from(Plan.table).where('plan_end_date', '<', new Date());
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
  console.log('Starting plan extension batch process..');
  const trx = await db.transaction();
  try {
    const currentDate = new Date();
    const oneYearLater = new Date();
    oneYearLater.setMonth(currentDate.getMonth() + 12);
    const expiringPlans = await Plan.fetchExpiringPlans(trx, currentDate, oneYearLater, 'plan.id');
    const requiredVotes = {};
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
        if (expiringPlan.email) await sendEmailToAgreementHolders(trx, expiringPlan);
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
    trx.commit();
  } catch (err) {
    trx.rollback();
    process.exit(0);
  }
  process.exit(0);
};

main();
