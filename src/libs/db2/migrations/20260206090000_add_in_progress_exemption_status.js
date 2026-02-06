//
// MyRA
//
// Copyright © 2018 Province of British Columbia
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
// Created for adding IN_PROGRESS exemption status.
//

'use strict';

const table = 'agreement_exemption_status';

exports.up = async (knex) => {
  const exists = await knex(table).where({ code: 'IN_PROGRESS' }).first();
  if (!exists) {
    await knex(table).insert({
      code: 'IN_PROGRESS',
      description: 'In Progress',
      active: true,
    });
  }
};

exports.down = async (knex) => {
  await knex(table).where({ code: 'IN_PROGRESS' }).del();
};
