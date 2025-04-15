exports.up = async (knex) => {
  await knex('ref_plan_status').where('id', 8).update({ name: 'Wrongly Made Stands' });
  await knex('ref_plan_status').where('id', 20).update({ name: 'Stands - Needs Decision - DM', active: true });
  await knex('ref_plan_status').where('id', 21).update({ name: 'Stands - Not Reviewed - SA' });
  await knex('ref_plan_status').where('id', 24).delete();
};

exports.down = async () => {};
