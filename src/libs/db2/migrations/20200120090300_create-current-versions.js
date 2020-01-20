exports.up = async (knex) => {
  const { rows: plans } = await knex.raw(`
  SELECT MAX(id) as id, canonical_id FROM plan
  GROUP BY canonical_id;
  `);

  const versionsP = plans.map(async (plan) => {
    const { rows } = await knex.raw(`
      INSERT INTO plan_version (version, canonical_id, plan_id)
      VALUES (-1, ?, ?)
      RETURNING *;
    `, [plan.canonical_id, plan.id]);

    return rows;
  });

  await Promise.all(versionsP);
};

exports.down = async (knex) => {
  await knex.raw(`
    DELETE FROM plan_version;
  `);
};
