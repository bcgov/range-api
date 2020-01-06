
exports.up = async (knex) => {
  // Change primary key of ref_client to `id`
  await knex.raw(`
    ALTER TABLE ref_client 
      DROP CONSTRAINT ref_client_pkey CASCADE,
      ADD COLUMN id SERIAL,
      ADD PRIMARY KEY (id);
  `);

  // Update foreign key references in other tables
  await knex.raw(`
    ALTER TABLE client_agreement 
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER NOT NULL,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);

  await knex.raw(`
    ALTER TABLE plan_confirmation
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER NOT NULL,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);

  await knex.raw(`
    ALTER TABLE user_account
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_client
      DROP COLUMN id,
      ADD PRIMARY KEY (client_number);
  `);
};
