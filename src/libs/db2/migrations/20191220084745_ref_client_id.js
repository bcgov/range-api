
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_client ADD COLUMN id SERIAL;
  `);

  const { rows: clients } = await knex.raw(`
    SELECT
      ref_client.client_number,
      ref_client.id,
      pc.ids AS plan_confirmation_ids,
      ca.ids AS client_agreement_ids,
      ua.ids AS user_account_ids
    FROM ref_client
    LEFT JOIN (
      SELECT client_id, ARRAY_AGG(plan_confirmation.id) AS ids
      FROM plan_confirmation
      GROUP BY 1
    ) pc ON pc.client_id = ref_client.client_number
    LEFT JOIN (
      SELECT client_id, ARRAY_AGG(client_agreement.id) AS ids
      FROM client_agreement
      GROUP BY 1
    ) ca ON ca.client_id = ref_client.client_number
    LEFT JOIN (
      SELECT client_id, ARRAY_AGG(user_account.id) AS ids
      FROM user_account
      GROUP BY 1
    ) ua ON ua.client_id = ref_client.client_number;
  `);

  // Change primary key of ref_client to `id`
  await knex.raw(`
    ALTER TABLE ref_client 
      DROP CONSTRAINT ref_client_pkey CASCADE,
      ADD PRIMARY KEY (id);
  `);

  // Update foreign key references in other tables
  await knex.raw(`
    ALTER TABLE client_agreement 
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);

  await knex.raw(`
    ALTER TABLE plan_confirmation
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);

  await knex.raw(`
    ALTER TABLE user_account
      DROP COLUMN client_id,
      ADD COLUMN client_id INTEGER,
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(id);
  `);

  const updatedClientsP = clients.map(async (client) => {
    const {
      plan_confirmation_ids: pcIds,
      client_agreement_ids: caIds,
      user_account_ids: uaIds,
    } = client;

    if (pcIds) {
      await knex.raw(`
        UPDATE plan_confirmation
        SET client_id = ? 
        WHERE id = ANY (?);
      `, [client.id, pcIds]);
    }
    if (caIds) {
      await knex.raw(`
        UPDATE client_agreement
        SET client_id = ? 
        WHERE id = ANY (?);
      `, [client.id, caIds]);
    }
    if (uaIds) {
      await knex.raw(`
        UPDATE user_account
        SET client_id = ? 
        WHERE id = ANY (?);
      `, [client.id, uaIds]);
    }
  });

  await updatedClientsP;
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_client
      DROP COLUMN id,
      ADD PRIMARY KEY (client_number);
  `);
};
