exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE client_agreement
      ADD COLUMN agent_id INTEGER,
      ADD FOREIGN KEY (agent_id)
        REFERENCES user_account(id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE client_agreement
      DROP COLUMN agent_id;
  `);
};
