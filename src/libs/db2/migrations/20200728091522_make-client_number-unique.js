exports.up = async (knex) => {
  // Custom aggregate function to concat arrays
  await knex.raw(`
    DROP AGGREGATE IF EXISTS array_agg_mult (anyarray);

    CREATE AGGREGATE array_cat_agg (
      anyarray) (
      SFUNC = array_cat,
      STYPE = anyarray
    );
  `);
  // Get clients
  const { rows: clients } = await knex.raw(`
    SELECT
      ref_client.client_number,
      array_agg(ref_client.id) client_ids,
      array_cat_agg (pc.ids) AS plan_confirmation_ids,
      array_cat_agg (ca.ids) AS client_agreement_ids,
      array_cat_agg (link.ids) AS link_ids
    FROM
      ref_client
      LEFT JOIN (
        SELECT
          client_id,
          ARRAY_AGG(plan_confirmation.id) AS ids
        FROM
          plan_confirmation
        GROUP BY
          1) pc ON pc.client_id = ref_client.id
      LEFT JOIN (
        SELECT
          client_id,
          ARRAY_AGG(client_agreement.id) AS ids
        FROM
          client_agreement
        GROUP BY
          1) ca ON ca.client_id = ref_client.id
      LEFT JOIN (
        SELECT
          client_id,
          ARRAY_AGG(user_client_link.id) AS ids
        FROM
          user_client_link
        GROUP BY
          1) link ON link.client_id = ref_client.id
    GROUP BY
      client_number;
  `);

  // Change type of client_id columns

  await knex.raw(`
    ALTER TABLE client_agreement 
      DROP COLUMN client_id,
      ADD COLUMN client_id VARCHAR
  `);

  await knex.raw(`
    ALTER TABLE plan_confirmation
      DROP COLUMN client_id,
      ADD COLUMN client_id VARCHAR
  `);

  await knex.raw(`
    ALTER TABLE user_client_link
      DROP COLUMN client_id,
      ADD COLUMN client_id VARCHAR
  `);

  // Update values for `client_id` to the client number
  const updatedClientsP = clients.map(async (client) => {
    const { plan_confirmation_ids: pcIds, client_agreement_ids: caIds, link_ids: linkIds } = client;

    if (pcIds) {
      await knex.raw(
        `
        UPDATE plan_confirmation
        SET client_id = ? 
        WHERE id = ANY (?);
      `,
        [client.client_number, pcIds],
      );
    }
    if (caIds) {
      await knex.raw(
        `
        UPDATE client_agreement
        SET client_id = ? 
        WHERE id = ANY (?);
      `,
        [client.client_number, caIds],
      );
    }
    if (linkIds) {
      await knex.raw(
        `
        UPDATE user_client_link
        SET client_id = ? 
        WHERE id = ANY (?);
      `,
        [client.client_number, linkIds],
      );
    }
  });

  await updatedClientsP;

  await knex.raw(`
    alter table ref_client
      add column location_codes varchar(2)[];
  `);

  // Populate location_codes with values from every row with the same client_number
  await knex.raw(`
    WITH subquery AS (
      SELECT
        id,
        array(
          SELECT location_code
          FROM ref_client
          WHERE ref_client.client_number = rc.client_number
        ) as location_codes
      FROM ref_client rc
    )
    UPDATE ref_client
    SET location_codes = subquery.location_codes
    FROM subquery
    WHERE ref_client.id = subquery.id;
  `);

  // Remove duplicates
  await knex.raw(`
    DELETE FROM
      ref_client a
          USING ref_client b
    WHERE
      a.id < b.id
      AND a.client_number = b.client_number;
  `);

  // Change primary key of ref_client to `client_number`
  await knex.raw(`
    ALTER TABLE ref_client 
      DROP CONSTRAINT ref_client_pkey CASCADE,
      ADD PRIMARY KEY (client_number);
  `);

  // Recreate foreign keys
  await knex.raw(`
    ALTER TABLE client_agreement
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(client_number);
    ALTER TABLE plan_confirmation
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(client_number);
    ALTER TABLE user_client_link
      ADD FOREIGN KEY (client_id) REFERENCES ref_client(client_number);
  `);

  // Remove old columns
  await knex.raw(`
    ALTER TABLE ref_client
      DROP COLUMN id,
      DROP COLUMN location_code;
  `);

  // Cleanup

  await knex.raw(`
    DROP AGGREGATE IF EXISTS array_agg_mult (anyarray);
  `);

  await knex.raw(`
    DROP FUNCTION IF EXISTS update_plan_conf_to_reflect_client_agreement() CASCADE;
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS update_plan_conf_with_old_client_agreement on client_agreement;
  `);
};

exports.down = async () => {};
