'use strict';

const table = 'ref_plant_community_action_type';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Herding',
      active: true,
    },
    {
      name: 'Livestock Variables',
      active: true,
    },
    {
      name: 'Salting',
      active: true,
    },
    {
      name: 'Supplemental Feeding',
      active: true,
    },
    {
      name: 'Timing',
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
