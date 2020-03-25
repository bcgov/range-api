const PlanSnapshot = require('../../../../build/src/libs/db2/model/plansnapshot').default;
const Agreement = require('../../../../build/src/libs/db2/model/agreement').default;

exports.up = async (knex) => {
  const { rows } = await knex.raw(`
    SELECT id, snapshot FROM plan_snapshot;
  `);

  const promises = rows.map(async ({ id, snapshot }) => {
    if (!snapshot.agreement) {
      const { agreementId } = snapshot;

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        knex, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();

      const newSnapshot = { ...snapshot, agreement };

      await PlanSnapshot.update(knex, { id }, {
        snapshot: JSON.stringify(newSnapshot),
      });
    }
  });

  await Promise.all(promises);
};

exports.down = async (knex) => {
  await knex.raw('');
};
