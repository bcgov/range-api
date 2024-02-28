exports.up = async (knex) => {
  await knex.raw(`
    CREATE TYPE client_account_type AS ENUM ('owner', 'agent');

    CREATE TABLE active_client_account(
      id SERIAL PRIMARY KEY NOT NULL,
      user_id INTEGER REFERENCES user_account(id) NOT NULL,
      client_id INTEGER REFERENCES ref_client(id) NOT NULL,
      type client_account_type DEFAULT 'owner',
      active BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER update_active_client_account_changetimestamp BEFORE UPDATE
      ON active_client_account FOR EACH ROW EXECUTE PROCEDURE 
      update_changetimestamp_column();
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE active_client_account;
  `);
};
