exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_districts DROP COLUMN code;
    ALTER TABLE user_districts DROP COLUMN description;
  `);
};

exports.down = async () => {};
