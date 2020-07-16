exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      ADD COLUMN conditions TEXT;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      DROP COLUMN conditions;
  `);
};
