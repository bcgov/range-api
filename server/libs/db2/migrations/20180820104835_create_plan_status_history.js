const table = 'plan_status_history';

exports.up = async knex =>
  knex.schema.createTable(table, async (t) => {
    t.increments('id').unsigned().index().primary();

    t.integer('plan_id').notNull();
    t.foreign('plan_id').onDelete('CASCADE').references('plan.id');
    t.integer('from_plan_status_id').notNull().references('ref_plan_status.id');
    t.integer('to_plan_status_id').notNull().references('ref_plan_status.id');
    t.integer('user_id').notNull().references('user_account.id');

    t.text('note').notNull();
    t.dateTime('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await knex.schema.raw(query);
  });

exports.down = knex =>
  knex.schema.dropTable(table);
