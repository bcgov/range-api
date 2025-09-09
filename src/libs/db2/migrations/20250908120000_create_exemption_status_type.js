exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE exemption_status_type (
      id SERIAL PRIMARY KEY,
      code VARCHAR(32) UNIQUE NOT NULL,
      description TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Insert default statuses
  await knex.raw(`
    INSERT INTO exemption_status_type (code, description, active)
    VALUES
      ('draft', 'Draft - editable by Staff Agrologist', TRUE),
      ('pending', 'Pending approval - submitted to Decision Maker', TRUE),
      ('approved', 'Approved - read only', TRUE),
      ('rejected', 'Rejected - editable by Staff Agrologist', TRUE),
      ('deleted', 'Deleted', FALSE)
  `);
};

exports.down = function (knex) {
  return knex.raw('DROP TABLE IF EXISTS exemption_status_type');
};
