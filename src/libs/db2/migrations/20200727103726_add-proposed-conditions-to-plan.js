exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      ADD COLUMN proposed_conditions TEXT;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      DROP COLUMN proposed_conditions;
  `);
};
