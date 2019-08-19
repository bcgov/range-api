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
      code: 'MA',
      description: 'Mandatory Amendment',
      active: true,
    },
    {
      code: 'A',
      description: 'Amendment',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
