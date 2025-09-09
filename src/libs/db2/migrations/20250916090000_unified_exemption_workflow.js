// Unified migration: agreement_exemption_status, exemption, exemption_status_type, exemption_status_history, exemption_attachment

exports.up = async function (knex) {
  // 1. Create agreement_exemption_status table
  await knex.raw(`
    CREATE TABLE agreement_exemption_status (
      id SERIAL PRIMARY KEY,
      code VARCHAR(32) UNIQUE NOT NULL,
      description VARCHAR(255) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`
    INSERT INTO agreement_exemption_status (id, code, description, active)
    VALUES
      (1, 'NOT_EXEMPTED', 'Not Exempted', TRUE),
      (2, 'ACTIVE', 'Active', TRUE),
      (3, 'SCHEDULED', 'Scheduled', TRUE)
  `);

  // 2. Add exemption_status column to agreement table
  await knex.raw(`ALTER TABLE agreement ADD COLUMN exemption_status VARCHAR(32) NOT NULL DEFAULT 'NOT_EXEMPTED';`);
  await knex.raw(
    `ALTER TABLE agreement ADD CONSTRAINT agreement_exemption_status_fk FOREIGN KEY (exemption_status) REFERENCES agreement_exemption_status(code);`,
  );
  await knex.raw(`UPDATE agreement SET exemption_status = 'NOT_EXEMPTED';`);

  // 4. Create exemption_status_type table
  await knex.raw(`
    CREATE TABLE exemption_status_type (
      id SERIAL PRIMARY KEY,
      code VARCHAR(32) UNIQUE NOT NULL,
      description TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await knex.raw(`
    INSERT INTO exemption_status_type (code, description, active)
    VALUES
      ('Draft', 'Draft - editable by Staff Agrologist', TRUE),
      ('Pending Approval', 'Pending approval - submitted to Decision Maker', TRUE),
      ('Approved', 'Approved - read only', TRUE),
      ('Rejected', 'Rejected - editable by Staff Agrologist', TRUE),
      ('Cancelled', 'Cancelled by Decision Maker', TRUE),
      ('Deleted', 'Deleted', TRUE)
  `);

  // 3. Create exemption table
  await knex.raw(`
    CREATE TABLE exemption (
      id SERIAL PRIMARY KEY,
      agreement_id VARCHAR(9) NOT NULL REFERENCES agreement(forest_file_id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      justification_text TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'Draft' REFERENCES exemption_status_type(code),
      user_id INTEGER NOT NULL REFERENCES user_account(id),
      approved_by INTEGER NULL REFERENCES user_account(id),
      approval_date TIMESTAMP WITH TIME ZONE NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Create exemption_status_history table
  await knex.raw(`
    CREATE TABLE exemption_status_history (
      id SERIAL PRIMARY KEY,
      exemption_id INTEGER NULL REFERENCES exemption(id) ON DELETE CASCADE,
      from_status VARCHAR(32) NULL REFERENCES exemption_status_type(code),
      to_status VARCHAR(32) NOT NULL REFERENCES exemption_status_type(code),
      note TEXT,
      user_id INTEGER NOT NULL REFERENCES user_account(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    );
  `);
  await knex.raw(`CREATE INDEX idx_exemption_status_history_exemption_id ON exemption_status_history(exemption_id);`);
  await knex.raw(`CREATE INDEX idx_exemption_status_history_to_status ON exemption_status_history(to_status);`);
  await knex.raw(
    `CREATE TRIGGER update_exemption_status_history_changetimestamp BEFORE UPDATE ON exemption_status_history FOR EACH ROW EXECUTE PROCEDURE update_changetimestamp_column();`,
  );

  // 6. Create exemption_attachment table
  await knex.raw(`
    CREATE TABLE exemption_attachment (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      url VARCHAR NOT NULL,
      type VARCHAR NOT NULL,
      access VARCHAR NOT NULL DEFAULT 'staff_only',
      exemption_id INTEGER NOT NULL REFERENCES exemption(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES user_account(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    );
  `);
  await knex.raw(`CREATE INDEX idx_exemption_attachment_exemption_id ON exemption_attachment(exemption_id);`);
  await knex.raw(`CREATE INDEX idx_exemption_attachment_user_id ON exemption_attachment(user_id);`);
  await knex.raw(
    `CREATE TRIGGER update_exemption_attachment_changetimestamp BEFORE UPDATE ON exemption_attachment FOR EACH ROW EXECUTE PROCEDURE update_changetimestamp_column();`,
  );

  // 7. Drop legacy tables/columns if they exist
  await knex.raw('DROP TABLE IF EXISTS ref_agreement_exemption_status CASCADE;');
  const hasOldCol = await knex.schema.hasColumn('agreement', 'agreement_exemption_status_id');
  if (hasOldCol) {
    await knex.schema.alterTable('agreement', (table) => {
      table.dropColumn('agreement_exemption_status_id');
    });
  }

  await knex.raw(`
    INSERT INTO email_template (name, from_email, subject, body)
    SELECT 'Exemption Status Change', 'MyRangeBC@gov.bc.ca', 'Exemption Status Update', 'Exemption for agreement {agreementId} is {toStatus}.'
    WHERE NOT EXISTS (
      SELECT 1 FROM email_template WHERE name = 'Exemption Status Change'
    )
  `);
  await knex.raw(`
    INSERT INTO email_template (name, from_email, subject, body)
    SELECT 'Agreement Exemption Status Change', 'MyRangeBC@gov.bc.ca', 'Agreement Exemption Status Change', 'Exemption {toStatus} for agreement {agreement_id}.'
    WHERE NOT EXISTS (
      SELECT 1 FROM email_template WHERE name = 'Agreement Exemption Status Change'
    )
  `);
};

exports.down = async function (knex) {
  await knex('email_template').where({ name: 'Agreement Exemption Status Change' }).del();
  await knex('email_template').where({ name: 'Exemption Status Change' }).del();
  await knex.raw('DROP TABLE IF EXISTS exemption_attachment CASCADE;');
  await knex.raw('DROP TABLE IF EXISTS exemption_status_history CASCADE;');
  await knex.raw('DROP TABLE IF EXISTS exemption_status_type CASCADE;');
  await knex.raw('DROP TABLE IF EXISTS exemption CASCADE;');
  await knex.raw('DROP TABLE IF EXISTS agreement_exemption_status CASCADE;');
  // Remove the new exemption_status column
  const hasNewCol = await knex.schema.hasColumn('agreement', 'exemption_status');
  if (hasNewCol) {
    await knex.schema.alterTable('agreement', (table) => {
      table.dropForeign('exemption_status');
      table.dropColumn('exemption_status');
    });
  }
  // Re-add the old foreign key column (no default value, must be handled manually)
  const hasOldCol = await knex.schema.hasColumn('agreement', 'agreement_exemption_status_id');
  if (!hasOldCol) {
    await knex.schema.alterTable('agreement', (table) => {
      table.integer('agreement_exemption_status_id').notNullable();
    });
  }
};
