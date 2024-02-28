const table = 'plan_version';

exports.up = async (knex) => {
  await knex.schema.table(table, async (t) => {
    t.dateTime('created_at')
      .notNull()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at')
      .notNull()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await knex.schema.raw(query);
  });
};

exports.down = async (knex) => {
  await knex.schema.table(table, async (t) => {
    t.dropTable('created_at');
    t.dropTable('updated_at');

    await knex.schema.raw(
      `REMOVE TRIGGER update_${table}_changetimestamp ON ${table}`,
    );
  });
};
