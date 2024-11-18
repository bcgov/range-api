exports.up = async (knex) => {
  await knex.raw(`
    INSERT INTO ref_plan_status
    (id, code, "name", active, description_full, description_short)
    VALUES(25, 'RE', 'Retired', true, '', '');
  `);
};

exports.down = async () => {};
