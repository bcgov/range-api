exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE public.plan DROP CONSTRAINT plan_extension_id_foreign;
    ALTER TABLE public.plan DROP COLUMN extension_id;
    DROP TABLE public.extension;
  `);
};

exports.down = async () => {};
