exports.up = async (knex) => {
  await knex.raw(`
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (3, 8);
  `);
};
