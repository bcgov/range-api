'use strict';

const table = 'ref_additional_requirement_category';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Notice or Order',
      active: true,
    },
    {
      name: 'Land Use Plan',
      active: true,
    },
    {
      name: 'Memorandum of Understanding',
      active: true,
    },
    {
      name: 'Agreement',
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
