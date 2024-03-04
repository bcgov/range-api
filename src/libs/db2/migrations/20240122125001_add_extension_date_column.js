exports.up = async (knex) => {
  await knex.raw(`
    alter table plan add extension_date timestamp null;
    alter table plan add extension_rejected_by int4 null;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    alter table plan drop column extension_date;
    alter table plan drop column extension_rejected_by;
  `);
};
