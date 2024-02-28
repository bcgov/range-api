exports.up = async (knex) => {
  const query = knex
    .table('ref_plan_status')
    .insert([
      {
        id: 21,
        description_full: '',
        description_short: '',
        code: 'SNR',
        name: 'Stands - Not Reviewed',
        active: true,
      },
      {
        id: 22,
        description_full: '',
        description_short: '',
        code: 'APS',
        name: 'Mandatory Amendment in Progress - Staff',
        active: true,
      },
      {
        id: 23,
        description_full: '',
        description_short: '',
        code: 'APA',
        name: 'Amendment in Progress - AH',
        active: true,
      },
    ])
    .toQuery();

  await knex.raw(`${query} ON CONFLICT DO NOTHING`);
};

exports.down = async (knex) => {
  await knex.table('ref_plan_status').delete().whereIn('id', [21, 22, 23]);
};
