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
// Created by Kyubin Han on 2018-07-17.
//

const table = 'plan';

exports.up = async knex =>
  knex.schema.table(table, async (t) => {
    t.integer('plan_type_id').defaultTo(null);
    t.foreign('plan_type_id').references('ref_plan_type.id');
  });

exports.down = async knex =>
  knex.schema.table(table, async (t) => {
    t.dropColumn('plan_type_id');
  });
