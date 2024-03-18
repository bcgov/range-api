exports.up = async (knex) => {
  await knex.raw(`
  CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) UNIQUE NOT NULL
  );`);
  await knex.raw(`
  CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) UNIQUE NOT NULL
  );`);

  await knex.raw(`
  INSERT INTO roles (description)
  VALUES
    ('Admin'),
    ('Staff Decision Maker'),
    ('Staff Agrologist'),
    ('Range Agreement Holder'),
    ('External Auditor');
  `);
  await knex.raw(`
  INSERT INTO permissions (description)
  VALUES
    ('Read everything as staff'),
    ('Read in my zones as staff'),
    ('Read in my districts as staff'),
    ('Write everything as staff'),
    ('Write in my zones as staff'),
    ('Write in my districts as staff'),
    ('Write in my RUPS as client'),
    ('Manage clients as staff'),
    ('Manage email templates as staff'),
    ('Decision maker as staff'),
    ('Assign users a role');
  `);
  await knex.raw(`
  CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INT,
    permission_id INT,
    CONSTRAINT role_id
      FOREIGN KEY(role_id)
        REFERENCES roles(id)
        ON DELETE SET NULL,
    CONSTRAINT permission_id
      FOREIGN KEY(role_id)
        REFERENCES permissions(id)
        ON DELETE SET NULL
  );`);
  await knex.raw(`
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (1, 1),
    (1, 4),
    (1, 8),
    (1, 9),
    (1, 10),
    (1, 11),
    (2, 6),
    (2, 10),
    (3, 2),
    (3, 5),
    (4, 7),
    (5, 1);
  `);
  await knex.raw(`
  ALTER TABLE user_account
  ADD COLUMN role_id INT;
  ALTER TABLE user_account
  ADD CONSTRAINT role_foreign_key
    FOREIGN KEY (role_id) REFERENCES roles(id);
  `);
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE user_account DROP COLUMN role_id');
  await knex.raw('DROP TABLE role_permissions');
  await knex.raw('DROP TABLE roles');
  await knex.raw('DROP TABLE permissions');
};
