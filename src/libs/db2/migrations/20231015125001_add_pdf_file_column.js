exports.up = function(knex) {
  return knex.schema.table('plan_snapshot', function(table) {
    table.binary('pdf_file');
  });
};

exports.down = function(knex) {
  return knex.schema.table('plan_snapshot', function(table) {
    table.dropColumn('pdf_file');
  });
};