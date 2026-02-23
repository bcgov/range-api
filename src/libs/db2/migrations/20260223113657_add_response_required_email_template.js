exports.up = async function (knex) {
  await knex.raw(`
    INSERT INTO email_template (name, from_email, subject, body)
    SELECT 'Response Required', 'MyRangeBC@gov.bc.ca', 'Response Required - Agreement {agreementId}', 'Your response is required on agreement {agreementId}. Please review and take action as needed.'
    WHERE NOT EXISTS (
      SELECT 1 FROM email_template WHERE name = 'Response Required'
    )
  `);
};

exports.down = async function (knex) {
  await knex('email_template').where({ name: 'Response Required' }).del();
};
