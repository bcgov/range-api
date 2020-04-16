exports.up = async (knex) => {
  await knex.raw(`
    CREATE UNIQUE INDEX user_client_link_unique_client_id_for_owner ON active_client_account (client_id) WHERE (type = 'owner');
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX user_client_link_unique_client_id_for_owner;
  `);
};
