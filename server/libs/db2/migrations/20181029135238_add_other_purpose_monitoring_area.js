'use strict';

const table = 'monitoring_area';

exports.up = async knex =>
  knex.schema.table(table, async (t) => {
    t.text('other_purpose');
  });

exports.down = knex =>
  knex.schema.table(table, async (t) => {
    t.dropColumn('other_purpose');
  });
