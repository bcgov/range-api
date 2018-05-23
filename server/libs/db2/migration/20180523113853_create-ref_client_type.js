
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

/* eslint-disable no-unused-vars */

const table = 'ref_client_type';

exports.up = (knex, Promise) =>
  knex.schema.createTable('products', (t) => {
    t.increments('id').unsigned().primary();
    t.string('code', 1).notNull();
    t.string('description', 32).notNull();
    t.boolean('active').notNull().defaultTo(true);
    t.dateTime('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.dateTime('updated_at').notNull();
    // t.string('name', 256).notNull();
    // t.text('decription').nullable();
    // t.decimal('price', 6, 2).notNull();
    // t.enum('category', ['apparel', 'electronics', 'furniture']).notNull();
    // table.bigInteger('AddressId').unsigned().index().references('id').inTable('Address')

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    knex.schema.raw(query);
  });

exports.down = (knex, Promise) =>
  knex.schema.dropTable('products');
