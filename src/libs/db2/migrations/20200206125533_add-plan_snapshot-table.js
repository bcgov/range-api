exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE plan_snapshot(
      id SERIAL PRIMARY KEY NOT NULL,
      snapshot JSON NOT NULL,
      plan_id INTEGER REFERENCES plan(id) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      status_id INTEGER REFERENCES ref_plan_status(id)
    );
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE plan_snapshot;
  `);
};
