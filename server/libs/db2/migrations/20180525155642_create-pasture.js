
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

const table = 'pasture';

exports.up = async knex =>
  knex.schema.createTable(table, async (t) => {
    t.increments('id').unsigned().index().primary();

    t.integer('plan_id').notNull().index();
    t.foreign('plan_id').onDelete('CASCADE').references('plan.id');

    t.text('name').notNull();
    t.integer('allowable_aum');
    t.integer('grace_days').notNull().defaultTo(3);
    t.float('pld_percent').notNull().defaultTo(0);
    t.text('notes');
    t.dateTime('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await knex.schema.raw(query);
  });

exports.down = knex =>
  knex.schema.dropTable(table);
