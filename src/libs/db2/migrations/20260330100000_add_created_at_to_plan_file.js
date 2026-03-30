'use strict';

exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE plan_file
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
  `);
  await knex.raw(`
    ALTER TABLE plan_file
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
  `);
  await knex.raw(`
    CREATE TRIGGER update_plan_file_changetimestamp
      BEFORE UPDATE ON plan_file
      FOR EACH ROW
      EXECUTE FUNCTION update_changetimestamp_column();
  `);
  await knex.raw(`
    UPDATE plan_file SET created_at = (
      SELECT p.created_at FROM plan p WHERE p.id = plan_file.plan_id
    );
  `);
  await knex.raw(`
    UPDATE plan_file SET updated_at = created_at;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_plan_file_changetimestamp ON plan_file;
  `);
  await knex.raw(`
    ALTER TABLE plan_file
    DROP COLUMN IF EXISTS updated_at;
  `);
  await knex.raw(`
    ALTER TABLE plan_file
    DROP COLUMN IF EXISTS created_at;
  `);
};
