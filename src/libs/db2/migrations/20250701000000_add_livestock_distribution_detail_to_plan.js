exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      ADD COLUMN livestock_distribution_detail TEXT;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan
      DROP COLUMN livestock_distribution_detail;
  `);
};
