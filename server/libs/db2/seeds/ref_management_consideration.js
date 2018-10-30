'use strict';

const table = 'ref_management_consideration_type';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Concern',
      active: true,
    },
    {
      name: 'Opportunity',
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
