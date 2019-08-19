'use strict';

const table = 'ref_plant_community_elevation';

exports.seed = async (knex) => {
  const ref = [
    {
      name: '<500',
      active: true,
    },
    {
      name: '500-699',
      active: true,
    },
    {
      name: '700-899',
      active: true,
    },
    {
      name: '900-1099',
      active: true,
    },
    {
      name: '1100-1299',
      active: true,
    },
    {
      name: '1300-1500',
      active: true,
    },
    {
      name: '>1500',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
