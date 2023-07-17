exports.up = async function (knex) {
  await knex.raw(`
  ALTER TABLE user_account ADD sso_id VARCHAR(255);

UPDATE user_account SET sso_id = username WHERE username LIKE 'bceid%' OR username LIKE 'idir%' OR username = 'rangeadmin' OR username = 'rangestaff';          
`);

};

exports.down = async function (knex) {
  ALTER TABLE user_account DROP COLUMN sso_id;
};
