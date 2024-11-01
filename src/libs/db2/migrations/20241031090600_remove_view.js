exports.up = async (knex) => {
  await knex.raw(`
    drop view plan_snapshot_summary
  `);
};

exports.down = async () => {};
