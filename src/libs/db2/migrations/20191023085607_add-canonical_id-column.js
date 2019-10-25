const tables = [
  'plan',
  'pasture',
  'plant_community',
  'indicator_plant',
  'monitoring_area',
  'monitoring_area_purpose',
  'plant_community_action',
  'grazing_schedule',
  'grazing_schedule_entry',
  'additional_requirement',
  'minister_issue',
  'minister_issue_action',
  'minister_issue_pasture',
  'management_consideration',
];

exports.up = async (knex) => {
  const promises = tables.map(async (table) => {
    await knex.raw(`ALTER TABLE ${table} ADD canonical_id INTEGER;`);
    await knex.raw(`UPDATE ${table} SET canonical_id = id;`);
  });

  await Promise.all(promises);
};

exports.down = async (knex) => {
  const promises = tables.map(async (table) => {
    knex.schema.alterTable(table, (t) => {
      t.dropColumn('version');
    });
  });

  await Promise.all(promises);
};

