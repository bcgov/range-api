exports.up = async (knex) => {
  await knex('ref_amendment_type').insert({
    id: 4,
    code: 'EXT',
    description: 'Plan Extension',
    active: true,
  });
};

exports.down = async () => {};
