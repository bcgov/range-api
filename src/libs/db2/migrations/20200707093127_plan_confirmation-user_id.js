exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_confirmation
      ADD COLUMN user_id INTEGER,
      ADD FOREIGN KEY (user_id)
        REFERENCES user_account(id),
      ADD COLUMN is_own_signature BOOL DEFAULT true NOT NULL;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_confirmation
      DROP COLUMN user_id,
      DROP COLUMN is_own_signature;
  `);
};
