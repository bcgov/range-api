exports.up = async (knex) => {
  await knex.raw(`
  CREATE TABLE plan_version (
    version SERIAL NOT NULL,
    canonical_id INTEGER NOT NULL,
    plan_id INTEGER REFERENCES plan(id),
    PRIMARY KEY (canonical_id, version)
  )`);
};

exports.down = async (knex) => {
  await knex.raw('DROP TABLE plan_version');
};
