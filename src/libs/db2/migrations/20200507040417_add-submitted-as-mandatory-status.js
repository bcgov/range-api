exports.up = async (knex) => {
  const query = knex
    .table('ref_plan_status')
    .insert([{
      id: 24,
      description_full: '',
      description_short: '',
      code: 'SAM',
      name: 'Submitted as Mandatory',
      active: true,
    }])
    .toQuery();

  await knex.raw(`${query} ON CONFLICT DO NOTHING`);
};

exports.down = async (knex) => {
  await knex
    .table('ref_plan_status')
    .delete()
    .whereIn('id', [24]);
};
