exports.up = async (knex) => {
  await knex.raw(`
    INSERT INTO ref_plan_status
    (id, code, "name", active, description_full, description_short)
    VALUES(26, 'EX', 'Expired', true, '', '');
  `);
};

exports.down = async () => {};
