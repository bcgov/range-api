exports.up = async (knex) => {
  await knex.raw(`
  ALTER TABLE agreement 
    ADD COLUMN retired BOOLEAN DEFAULT FALSE;
  `);
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE user_account DROP COLUMN retired');
};
