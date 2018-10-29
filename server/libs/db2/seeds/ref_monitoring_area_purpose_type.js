'use strict';

const table = 'ref_monitoring_area_purpose_type';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Range Readiness',
      active: true,
    },
    {
      name: 'Stubble Height',
      active: true,
    },
    {
      name: 'Shrub Usage',
      active: true,
    },
    {
      name: 'Key Area',
      active: true,
    },
    {
      name: 'Other',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
