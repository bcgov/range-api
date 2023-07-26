exports.up = async function(knex) {
  await knex.raw(`
    create table email_template (
      id serial2 NOT NULL,
      name varchar NOT NULL,
      from_email varchar NOT NULL,
      subject varchar NOT NULL,
      body varchar NULL,
      CONSTRAINT email_template_pk PRIMARY KEY (id)
    );
    INSERT INTO email_template
    (name, from_email, subject, body)
    VALUES('Plan Status Change', 'myrange@bc.gov.ca', 'Plan status changed - {agreementId}', 'Plan status changed from {fromStatus} to {toStatus} for the agreement {agreementId}');
`);

};

exports.down = async function(knex) {
  await knex.raw(`
    drop table email_template;
`);
};