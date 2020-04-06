exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE active_client_account
    RENAME TO user_client_link;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_client_link
    RENAME TO active_client_account;
  `);
};
