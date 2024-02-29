exports.up = async (knex) => {
  await knex.raw(`
    alter table plan add extension_date timestamp null;
  `);
};

exports.down = async (knex) => {
  await knex.raw('alter table plan drop column extension_date');
};