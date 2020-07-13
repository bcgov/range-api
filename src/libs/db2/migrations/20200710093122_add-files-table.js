exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE plan_file(
      id SERIAL PRIMARY KEY NOT NULL,
      name VARCHAR NOT NULL,
      url VARCHAR NOT NULL,
      type VARCHAR NOT NULL,
      access VARCHAR NOT NULL DEFAULT 'staff_only',
      plan_id INTEGER NOT NULL REFERENCES plan(id),
      user_id INTEGER NOT NULL REFERENCES user_account(id)
    );
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP TABLE plan_file');
};
