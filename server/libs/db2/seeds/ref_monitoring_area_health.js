'use strict';

const table = 'ref_monitoring_area_health';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Properly Funcitoning Condition',
      active: true,
    },
    {
      name: 'Slightly at Risk',
      active: true,
    },
    {
      name: 'Moderatly at Risk',
      active: true,
    },
    {
      name: 'Highly at Risk',
      active: true,
    },
    {
      name: 'Non-functional',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
