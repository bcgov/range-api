//
// MyRA
//
// Copyright © 2018 Province of British Columbia
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
// Created by Jason Leach on 2018-05-23.
//

'use strict';

/* eslint-disable newline-per-chained-call */

const table = 'agreement';

exports.up = async (knex) =>
  knex.schema.createTable(table, async (t) => {
    t.string('forest_file_id', 9).index().primary();
    t.dateTime('agreement_start_date').notNull();
    t.dateTime('agreement_end_date').notNull();
    t.integer('agreement_exemption_status_id')
      .notNull()
      .references('id')
      .inTable('ref_agreement_exemption_status');
    t.integer('agreement_type_id')
      .notNull()
      .references('id')
      .inTable('ref_agreement_type');
    t.integer('zone_id').notNull().references('id').inTable('ref_zone');
    t.dateTime('created_at')
      .notNull()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at')
      .notNull()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await knex.schema.raw(query);
  });

exports.down = (knex) => knex.schema.dropTable(table);
