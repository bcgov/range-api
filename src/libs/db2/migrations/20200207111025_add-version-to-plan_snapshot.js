exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_snapshot
      ADD COLUMN version SERIAL,
      ADD CONSTRAINT version_plan_id_unique UNIQUE (plan_id, version);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_snapshot
      DROP CONSTRAINT version_plan_id_unique,
      DROP COLUMN version;
  `);
};
