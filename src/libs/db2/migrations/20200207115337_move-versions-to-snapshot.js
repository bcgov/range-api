const Plan = require('../../../../build/src/libs/db2/model/plan').default;
const Agreement =
  require('../../../../build/src/libs/db2/model/agreement').default;

exports.up = async (knex) => {
  /**
   * Returns data in this format:
   * [{ canonical_id: ID, past_plan_ids: ID[], current_plan_id: ID }]
   * Grouped by each unique canonical_id in plan_version.
   */
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

  const promises = rows
    .filter((row) => row.past_plan_ids !== null)
    .map(
      async ({
        past_plan_ids: pastPlanIds = [],
        current_plan_id: currentPlanId,
      }) => {
        const snapshotsP = pastPlanIds.map(async (planId) => {
          const {
            rows: [versionRecord],
          } = await knex.raw(
            `
          SELECT * FROM plan_version WHERE plan_id = ?;
        `,
            [planId],
          );

          const [plan] = await Plan.findWithStatusExtension(
            knex,
            {
              'plan.id': planId,
            },
            ['id', 'desc'],
          );

          const agreementId = await Plan.agreementForPlanId(knex, plan.id);

          const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
            knex,
            { forest_file_id: agreementId },
          );
          await agreement.eagerloadAllOneToManyExceptPlan();
          agreement.transformToV1();

          await plan.eagerloadAllOneToMany();

          await knex.raw(
            `
          INSERT INTO plan_snapshot (snapshot, created_at, version, plan_id, status_id)
          VALUES (?, ?, ?, ?, ?)
        `,
            [
              JSON.stringify({ ...plan, agreement }),
              versionRecord.created_at,
              versionRecord.version,
              currentPlanId,
              plan.statusId,
            ],
          );
        });

        const snapshots = await Promise.all(snapshotsP);

        return snapshots;
      },
    );

  await Promise.all(promises);
};

exports.down = async (knex) => {
  await knex.raw(`
    DELETE FROM plan_snapshot;
  `);
};
