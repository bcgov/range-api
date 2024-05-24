exports.up = async (knex) => {
  await knex.raw(`
    alter table plan add extension_plan_id int null;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    alter table plan drop column extension_plan_id;
  `);
};
