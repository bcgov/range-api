'use strict';

const table = 'ref_amendment_type';

exports.seed = async (knex) => {
  const ref = [
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
