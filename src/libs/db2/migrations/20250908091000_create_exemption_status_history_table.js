exports.up = function (knex) {
  return knex.raw(`
    CREATE TABLE exemption_status_history (
      id SERIAL PRIMARY KEY,
      exemption_id INTEGER NOT NULL REFERENCES exemption(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL,
      changed_by INTEGER REFERENCES user_account(id),
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      comment TEXT
    )
  `);
};

exports.down = function (knex) {
  return knex.raw('DROP TABLE IF EXISTS exemption_status_history');
};
