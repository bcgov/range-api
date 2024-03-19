import config from '../src/config';
import DataManager from '../src/libs/db2';
import EmailTemplate from '../src/libs/db2/model/emailtemplate';
import { Mailer } from '../src/libs/mailer';
import { substituteFields } from '../src/libs/utils';

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

const processExpiredPlans = async (trx) => {
  const results = await trx
    .select(['plan.id as planId'])
    .from(Plan.table)
    .where('plan_end_date', '<', new Date())
    .whereNotNull('extension_status');
  for (const result of results) {
    try {
      console.log(`Removing extension for expired planId: ${result.planId}`);
      await PlanExtensionRequests.remove(trx, {
        plan_id: result.planId,
      });
      await Plan.update(
        trx,
        { id: result.planId },
        {
          extension_status: null,
          extension_required_votes: 0,
          extension_received_votes: 0,
          extension_date: null,
          extension_rejected_by: null,
        },
      );
    } catch (error) {
      console.log(error.stack);
    }
  }
};

const main = async () => {
  const trx = await db.transaction();
  try {
    const currentDate = new Date();
    const oneYearLater = new Date();
    oneYearLater.setMonth(currentDate.getMonth() + 12);
    const expiringPlans = await Plan.fetchExpiringPlanIds(
      trx,
      currentDate,
      oneYearLater,
      'plan.id',
    );
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
        if (requiredVotes[expiringPlan.planId] === undefined)
          requiredVotes[expiringPlan.planId] = 1;
        else
          requiredVotes[expiringPlan.planId] =
            requiredVotes[expiringPlan.planId] + 1;
        if (expiringPlan.email)
          await sendEmailToAgreementHolders(trx, expiringPlan);
      } catch (error) {
        console.log(error);
      }
    }
    for (const planId of Object.keys(requiredVotes)) {
      await Plan.update(
        trx,
        { id: planId },
        { extensionRequiredVotes: requiredVotes[planId], extensionStatus: 1 },
      );
    }
    await processExpiredPlans(trx);
    trx.commit();
  } catch (err) {
    trx.rollback();
    process.exit(0);
  }
  process.exit(0);
};

main();
