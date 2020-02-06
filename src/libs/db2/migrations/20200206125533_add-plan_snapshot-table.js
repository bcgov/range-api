exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE plan_snapshot(
      id SERIAL PRIMARY KEY NOT NULL,
      snapshot JSON NOT NULL,
      plan_id INTEGER REFERENCES plan(id) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await knex.raw(`
    CREATE TRIGGER update_plan_snapshot_changetimestamp BEFORE UPDATE
    ON plan_snapshot FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE plan_snapshot;
  `);
};
