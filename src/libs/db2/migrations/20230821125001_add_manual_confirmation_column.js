exports.up = async function(knex) {
  await knex.raw(`
   ALTER TABLE plan_confirmation ADD is_manual_confirmation boolean NULL DEFAULT false;
`);

};

exports.down = async function(knex) {
  await knex.raw(`
    ALTER TABLE plan_confirmation DROP COLUMN is_manual_confirmation;
`);
};