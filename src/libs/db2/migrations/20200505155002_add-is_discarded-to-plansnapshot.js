exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_snapshot
      ADD COLUMN is_discarded BOOLEAN DEFAULT FALSE NOT NULL;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_snapshot
      DROP COLUMN is_discarded;
  `);
};
