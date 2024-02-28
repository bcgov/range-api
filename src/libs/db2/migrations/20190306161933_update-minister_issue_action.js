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

const table = 'minister_issue_action';

exports.up = async (knex) =>
  knex.schema.table(table, async (t) => {
    t.integer('no_graze_start_day');
    t.integer('no_graze_start_month');
    t.integer('no_graze_end_day');
    t.integer('no_graze_end_month');
  });

exports.down = (knex) =>
  knex.schema.table(table, async (t) => {
    t.dropColumn('no_graze_start_day');
    t.dropColumn('no_graze_start_month');
    t.dropColumn('no_graze_end_day');
    t.dropColumn('no_graze_end_month');
  });
