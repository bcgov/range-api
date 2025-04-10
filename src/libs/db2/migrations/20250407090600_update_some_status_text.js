exports.up = async (knex) => {
  await knex('ref_plan_status').where('id', 6).update({ name: 'Staff Draft - SA' });
  await knex('ref_plan_status').where('id', 21).update({ name: 'Stands - Not Reviewed - SA' });
  await knex('ref_plan_status').where('id', 2).update({ active: false });
  await knex('ref_plan_status').where('id', 3).update({ active: false });
  await knex('ref_plan_status').where('id', 4).update({ active: false });
  await knex('ref_plan_status').where('id', 17).update({ active: false });
  await knex('ref_plan_status').where('id', 20).update({ active: false });
  await knex('ref_plan_status').where('id', 24).update({ active: false });
};

exports.down = async () => {};
