exports.up = async (knex) => {
  await knex.raw(`
    DELETE FROM
      client_agreement a
          USING client_agreement b
    WHERE
      a.id < b.id
      AND a.agreement_id = b.agreement_id
      AND a.client_id = b.client_id;
  `);
  await knex.raw(`
    DELETE FROM
      plan_confirmation a
          USING plan_confirmation b
    WHERE
      a.id < b.id
      AND a.plan_id = b.plan_id
      AND a.client_id = b.client_id;
  `);
  await knex.raw(`
    DELETE FROM
      user_client_link a
          USING user_client_link b
    WHERE
      a.id < b.id
      AND a.user_id = b.user_id
      AND a.client_id = b.client_id;
  `);
};

exports.down = async () => {};
