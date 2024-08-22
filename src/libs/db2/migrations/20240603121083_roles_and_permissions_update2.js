exports.up = async (knex) => {
  await knex.raw(`
    UPDATE role_permissions
    SET permission_id = 3
    WHERE role_id = 5;
  `);
};
