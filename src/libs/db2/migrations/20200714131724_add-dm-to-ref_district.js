exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_district
      ADD COLUMN user_id INTEGER,
      ADD FOREIGN KEY (user_id)
        REFERENCES user_account(id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_district
      DROP COLUMN user_id;
  `);
};
