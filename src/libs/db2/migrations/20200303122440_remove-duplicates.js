const Plan = require('../../../../build/src/libs/db2/model/plan').default;
const Agreement = require('../../../../build/src/libs/db2/model/agreement').default;

exports.up = async (knex) => {
  const { rows } = await knex.raw(`
  SELECT
    plan_version.canonical_id as canonical_id,
    ARRAY_AGG(plan_version.plan_id) FILTER (WHERE plan_version.version != - 1) AS past_plan_ids,
    (
      SELECT
        id
      FROM
        plan
        JOIN plan_version pv ON id = pv.plan_id
          AND pv.canonical_id = plan_version.canonical_id
      WHERE
        pv.version = - 1
      LIMIT 1) AS current_plan_id
  FROM
    plan_version
  GROUP BY
    plan_version.canonical_id;
  `);

  const promises = await rows
    .filter(row => row.past_plan_ids !== null)
    .map(async ({
      past_plan_ids: pastPlanIds = [],
    }) => {
      await Promise.all(pastPlanIds.map(async (pastPlanId) => {
        console.log(`Deleting plan ${pastPlanId}`);

        await knex.raw('DELETE FROM plan_version WHERE plan_id=?', [pastPlanId]);
        await knex.raw('DELETE FROM plan WHERE id=?', [pastPlanId]);
      }));
    });

  await Promise.all(promises);

  const { rows: nonVersionedPlanIds } = await knex.raw(`
    SELECT id, agreement_id FROM plan where plan.id not in (select plan_id from plan_snapshot);
  `);
  

  await Promise.all(
    nonVersionedPlanIds.map(async ({ id, agreement_id: agreementId }, i) => {
      const { rows: [currentPlan] } = await knex.raw(`
        SELECT * FROM plan_snapshot WHERE plan_id IN (SELECT id FROM plan WHERE agreement_id=?) LIMIT 1;
      `, [agreementId]);

      if (currentPlan) {
        console.log(`Creating snapshot from ${id} on plan ${currentPlan.plan_id}`);

        const [plan] = await Plan.findWithStatusExtension(knex, {
          'plan.id': id },
        ['id', 'desc']);

        if (!plan) {
          console.log(`Could not find plan ${id}. 'uploaded' is probably false`);
        } else {
          const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
            knex, { forest_file_id: agreementId },
          );
          await agreement.eagerloadAllOneToManyExceptPlan();
          agreement.transformToV1();

          await plan.eagerloadAllOneToMany();

          const { rows: [{ version: lastVersion }] } = await knex.raw(
            'SELECT version FROM plan_snapshot WHERE plan_id=? ORDER BY version DESC LIMIT 1;',
            [currentPlan.plan_id],
          );

          await knex.raw(`
            INSERT INTO plan_snapshot (snapshot, created_at, version, plan_id, status_id)
            VALUES (?, ?, ?, ?, ?)
          `, [
            JSON.stringify({
              ...plan,
              agreement,
            }),
            plan.created_at ?? null,
            lastVersion + (1 * i) + 1,
            currentPlan.plan_id,
            plan.statusId,
          ]);

          console.log(`Deleting plan ${id}`);

          await knex.raw('DELETE FROM plan_version WHERE plan_id=?', [id]);
          await knex.raw('DELETE FROM plan WHERE id=?', [id]);
        }
      }
    }),
  );

  // Reset version increments
  await knex.raw('UPDATE plan_snapshot SET version = version + 10000');

  const { rows: snapshotSets } = await knex.raw('SELECT plan_id, ARRAY_AGG(id ORDER BY created_at ASC) AS ids FROM plan_snapshot GROUP BY plan_id');

  await Promise.all(
    snapshotSets.map(async ({ ids }) => {
      await Promise.all(
        ids.map(async (id, i) => {
          await knex.raw('UPDATE plan_snapshot SET version=? WHERE id=?', [i + 1, id]);
        }),
      );
    }),
  );
};

exports.down = async (knex) => {
  
};
