const table = 'plan';

exports.up = async knex =>
  knex.schema.table(table, async (t) => {
    t.integer('plan_type_id').notNull().defaultTo(null);
    t.foreign('plan_type_id').references('ref_plan_type.id');
  });

exports.down = async knex =>
  knex.schema.table(table, async (t) => {
    t.dropColumn('plan_type_id');
  });
