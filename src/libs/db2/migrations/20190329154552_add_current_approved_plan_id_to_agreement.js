
//
// MyRA
//
// Copyright © 2019 Province of British Columbia
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
// Created by Kyubin Han
//

'use strict';

/* eslint-disable no-unused-vars */

const table = 'agreement';

exports.up = async knex =>
  knex.schema.table(table, async (t) => {
    // TODO: update this field every time a new plan is approved
    t.integer('current_approved_plan_id'); // to keep track of the most recent approved plan or amendment
  });

exports.down = knex =>
  knex.schema.table(table, async (t) => {
    t.dropColumn('current_approved_plan_id');
  });
