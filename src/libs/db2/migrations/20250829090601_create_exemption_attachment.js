//
// MyRA
//
// Copyright © 2025 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict';

const table = 'exemption_attachment';

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE ${table} (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      url VARCHAR NOT NULL,
      type VARCHAR NOT NULL,
      access VARCHAR NOT NULL DEFAULT 'staff_only',
      exemption_history_id INTEGER NOT NULL REFERENCES exemption_status_history(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES user_account(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    );
  `);

  await knex.raw(`CREATE INDEX idx_${table}_exemption_history_id ON ${table}(exemption_history_id);`);
  await knex.raw(`CREATE INDEX idx_${table}_user_id ON ${table}(user_id);`);

  await knex.raw(`
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();
  `);
};

exports.down = (knex) => knex.raw(`DROP TABLE IF EXISTS ${table} CASCADE;`);
