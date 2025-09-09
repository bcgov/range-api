exports.up = function (knex) {
  return knex.raw(`
    CREATE TABLE exemption (
      id SERIAL PRIMARY KEY,
      agreement_id VARCHAR(9) NOT NULL REFERENCES agreement(forest_file_id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      justification_text TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

exports.down = function (knex) {
  return knex.raw('DROP TABLE IF EXISTS exemption');
};
