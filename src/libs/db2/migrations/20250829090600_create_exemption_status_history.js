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

const table = 'exemption_status_history';

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE ${table} (
      id SERIAL PRIMARY KEY,
      agreement_id VARCHAR(9) NOT NULL REFERENCES agreement(forest_file_id) ON DELETE CASCADE,
      exemption_status_id INTEGER NOT NULL REFERENCES ref_agreement_exemption_status(id),
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      reason TEXT NOT NULL,
      justification_text TEXT,
      user_id INTEGER NOT NULL REFERENCES user_account(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    );
  `);

  await knex.raw(`CREATE INDEX idx_${table}_agreement_id ON ${table}(agreement_id);`);
  await knex.raw(`CREATE INDEX idx_${table}_date_range ON ${table}(agreement_id, start_date, end_date);`);
  await knex.raw(`CREATE INDEX idx_${table}_exemption_status ON ${table}(exemption_status_id);`);

  await knex.raw(`
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();
  `);
};

exports.down = (knex) => knex.raw(`DROP TABLE IF EXISTS ${table} CASCADE;`);
