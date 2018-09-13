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

const table = 'ref_plan_status';

exports.seed = async (knex) => {
  const ref = [
    {
      description_full: '',
      description_short: '',
      code: 'C',
      name: 'Created',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'O',
      name: 'Completed',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'P',
      name: 'Pending',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'D',
      name: 'Draft',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'R',
      name: 'Change Requested',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'SD',
      name: 'Staff Draft',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'WM',
      name: 'Wrongly Made - Without Effect',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'SW',
      name: 'Stands - Wrongly Made',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'S',
      name: 'Stands',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'NF',
      name: 'Not Approved - Further Work Required',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'NA',
      name: 'Not Approved',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'A',
      name: 'Approved',
      active: true,
    },

    {
      description_full: '',
      description_short: '',
      code: 'SR',
      name: 'Submitted For Review',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'SFD',
      name: 'Submitted For Final Decision',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'RR',
      name: 'Recommend Ready',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'RNR',
      name: 'Recommend Not Ready',
      active: true,
    },
    {
      description_full: '',
      description_short: '',
      code: 'RFD',
      name: 'Ready For Final Decision',
      active: true,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
