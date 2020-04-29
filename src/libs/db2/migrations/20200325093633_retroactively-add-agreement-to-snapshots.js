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

      await knex.raw(`
        UPDATE plan_snapshot SET snapshot=? WHERE id=?
      `, [JSON.stringify(newSnapshot), id]);
    }
  });

  await Promise.all(promises);
};

exports.down = async (knex) => {
  await knex.raw('');
};
