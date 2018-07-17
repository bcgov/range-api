const table = 'ref_plan_type';

exports.up = async knex =>
  knex.schema.createTable(table, async (t) => {
    t.increments('id').unsigned().index().primary();
    t.string('code', 4).notNull();
    t.string('description', 32).notNull();
    t.boolean('active').notNull().defaultTo(true);
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
