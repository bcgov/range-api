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
// Created by Jason Leach on 2018-06-01.
//

/* eslint-disable no-param-reassign */

'use strict';

const table = 'ref_livestock_identifier_type';

exports.seed = async (knex) => {
  const ref = [
    {
      code: 'C',
      name: 'Created',
      active: true,
    },
    {
      code: 'O',
      name: 'Completed',
      active: true,
    },
    {
      code: 'P',
      name: 'Pending',
      active: true,
    },
    {
      code: 'D',
      name: 'Draft',
      active: true,
    },
    {
      code: 'R',
      name: 'Change Requested',
      active: true,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
