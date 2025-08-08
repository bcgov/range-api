exports.up = async (knex) => {
  await knex.schema.table('agreement', (table) => {
    table.integer('usage_status').defaultTo(null).comment('0: NoUse, 1: OverUse, null: Normal');
  });
};

exports.down = async (knex) => {
  await knex.schema.table('agreement', (table) => {
    table.dropColumn('usage_status');
  });
};
