
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

const table = 'plan';

exports.up = async knex =>
  knex.schema.createTable(table, async (t) => {
    t.increments('id').unsigned().index().primary();

    t.string('agreement_id', 9).notNull().references('agreement.forest_file_id');
    t.integer('status_id').notNull().references('id').inTable('ref_plan_status');
    t.integer('extension_id').references('id').inTable('extension');
    t.integer('amendment_type_id').defaultTo(null).references('ref_amendment_type.id');
    t.integer('creator_id').notNull().references('user_account.id');

    t.text('range_name').notNull();
    t.text('alt_business_name');
    t.dateTime('plan_start_date');
    t.dateTime('plan_end_date');
    t.text('notes');
    t.dateTime('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.boolean('uploaded').notNull().defaultTo(false);
    t.dateTime('effective_at');
    t.dateTime('submitted_at');

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await knex.schema.raw(query);
  });

exports.down = knex =>
  knex.schema.dropTable(table);
