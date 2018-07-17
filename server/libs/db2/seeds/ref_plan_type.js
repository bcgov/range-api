'use strict';

const table = 'ref_plan_type';

exports.seed = async (knex) => {
  const ref = [
    {
      code: 'CL',
      description: 'Clarification',
      active: true,
    },
    {
      code: 'MNA',
      description: 'Minor Amendment',
      active: true,
    },
    {
      code: 'MJA',
      description: 'Major Amendment',
      active: true,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
