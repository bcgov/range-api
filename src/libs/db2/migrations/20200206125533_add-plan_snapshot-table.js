exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE plan_snapshot(
      id SERIAL PRIMARY KEY NOT NULL,
      snapshot JSON NOT NULL,
      plan_id INTEGER REFERENCES plan(id) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE plan_snapshot;
  `);
};