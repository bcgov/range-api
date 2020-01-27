exports.up = async (knex) => {
  await knex.raw("CREATE TYPE schedule_sort_order AS ENUM('asc', 'desc')");
  await knex.raw(`
    ALTER TABLE grazing_schedule 
      ADD COLUMN sort_by VARCHAR,
      ADD COLUMN sort_order SCHEDULE_SORT_ORDER;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE grazing_schedule
      DROP COLUMN sort_by,
      DROP COLUMN sort_order;
  `);
};
