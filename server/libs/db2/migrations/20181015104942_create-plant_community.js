
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
// Created by Kyubin Han on 2018-10-15.
//

'use strict';

/* eslint-disable no-unused-vars */

const table = 'plant_community';

exports.up = async knex =>
  knex.schema.createTable(table, async (t) => {
    t.increments('id').unsigned().index().primary();

    t.integer('community_type_id').notNull().references('ref_plant_community_type.id');
    t.integer('elevation_id').references('ref_plant_community_elevation.id');
    t.integer('pasture_id').notNull();
    t.foreign('pasture_id').onDelete('CASCADE').references('pasture.id');

    t.enu('purpose_of_action', ['establish', 'maintain', 'none']).notNull();
    t.boolean('approved').notNull().defaultTo(false);
    t.text('name');
    t.text('aspect');
    t.text('url');
    t.text('notes');
    t.integer('range_readiness_day');
    t.integer('range_readiness_month');
    t.text('range_readiness_note');

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
