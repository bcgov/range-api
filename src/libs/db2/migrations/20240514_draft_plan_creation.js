exports.up = async (knex) => {
  await knex.raw(`
    alter table plan add replacement_plan_id int null;
    alter table plan rename column extension_of to replacement_of;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    alter table plan drop column replacement_plan_id;
  `);
};
