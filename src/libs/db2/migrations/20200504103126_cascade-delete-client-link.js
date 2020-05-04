exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_client_link
      DROP CONSTRAINT active_client_account_user_id_fkey,
      ADD CONSTRAINT user_client_link_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES user_account(id)
        ON DELETE CASCADE;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_client_link
      DROP CONSTRAINT user_client_link_user_id_fkey,
      ADD CONSTRAINT active_client_account_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES user_account(id);
  `);
};
