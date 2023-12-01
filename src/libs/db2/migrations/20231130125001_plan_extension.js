exports.up = async (knex) => {
  await knex.raw(`
    create table plan_extension_requests (
      id serial4 not null primary key,
      plan_id int, 
      client_id varchar,
      user_id int,
      email text,
      requested_extension boolean null,
      created_at timestamptz not null default 'now'::text::timestamp(3) with time zone,
      updated_at timestamptz not null default 'now'::text::timestamp(3) with time zone
    )`);
  await knex.raw(`
    create trigger update_plan_extension_requests_changetimestamp before
    update
        on
        plan_extension_requests for each row execute function update_changetimestamp_column()
    )`);

  await knex.raw(`
    alter table plan add extension_status int4 null;
  `);
  await knex.raw(`
    alter table plan add extension_required_votes int4 null;
  `);
  await knex.raw(`
    alter table plan add extension_received_votes int4 null;
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP TABLE plan_extension_requests');
  await knex.raw('ALTER TABLE plan DROP COLUMN extension_status');
  await knex.raw('ALTER TABLE plan DROP COLUMN extension_required_votes');
  await knex.raw('ALTER TABLE plan DROP COLUMN extension_received_votes');
};