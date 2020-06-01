exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      ADD COLUMN is_restored BOOL DEFAULT FALSE;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      DROP COLUMN is_restored;
  `);
};
