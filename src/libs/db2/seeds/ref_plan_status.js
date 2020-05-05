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
      id: 1,
      description_full: '',
      description_short: '',
      code: 'C',
      name: 'Created',
      active: true,
    },
    {
      id: 2,
      description_full: '',
      description_short: '',
      code: 'O',
      name: 'Completed',
      active: true,
    },
    {
      id: 3,
      description_full: '',
      description_short: '',
      code: 'P',
      name: 'Pending',
      active: true,
    },
    {
      id: 4,
      description_full: '',
      description_short: '',
      code: 'D',
      name: 'Draft',
      active: true,
    },
    {
      id: 5,
      description_full: '',
      description_short: '',
      code: 'R',
      name: 'Change Requested',
      active: true,
    },
    {
      id: 6,
      description_full: '',
      description_short: '',
      code: 'SD',
      name: 'Staff Draft',
      active: true,
    },
    {
      id: 7,
      description_full: '',
      description_short: '',
      code: 'WM',
      name: 'Wrongly Made - Without Effect',
      active: true,
    },
    {
      id: 8,
      description_full: '',
      description_short: '',
      code: 'SW',
      name: 'Stands - Wrongly Made',
      active: true,
    },
    {
      id: 9,
      description_full: '',
      description_short: '',
      code: 'S',
      name: 'Stands',
      active: true,
    },
    {
      id: 10,
      description_full: '',
      description_short: '',
      code: 'NF',
      name: 'Not Approved - Further Work Required',
      active: true,
    },
    {
      id: 11,
      description_full: '',
      description_short: '',
      code: 'NA',
      name: 'Not Approved',
      active: true,
    },
    {
      id: 12,
      description_full: '',
      description_short: '',
      code: 'A',
      name: 'Approved',
      active: true,
    },

    {
      id: 13,
      description_full: '',
      description_short: '',
      code: 'SR',
      name: 'Submitted For Review',
      active: true,
    },
    {
      id: 14,
      description_full: '',
      description_short: '',
      code: 'SFD',
      name: 'Submitted For Final Decision',
      active: true,
    },
    {
      id: 15,
      description_full: '',
      description_short: '',
      code: 'RR',
      name: 'Recommend Ready',
      active: true,
    },
    {
      id: 16,
      description_full: '',
      description_short: '',
      code: 'RNR',
      name: 'Recommend Not Ready',
      active: true,
    },
    {
      id: 17,
      description_full: '',
      description_short: '',
      code: 'RFD',
      name: 'Ready For Final Decision',
      active: true,
    },
    {
      id: 18,
      description_full: '',
      description_short: '',
      code: 'AC',
      name: 'Awaiting Confirmation',
      active: true,
    },
    {
      id: 19,
      description_full: '',
      description_short: '',
      code: 'RFS',
      name: 'Recommended For Submission',
      active: true,
    },
    {
      id: 20,
      description_full: '',
      description_short: '',
      code: 'MSR',
      name: 'Stands - Review',
      active: true,
    },
    {
      id: 21,
      description_full: '',
      description_short: '',
      code: 'SNR',
      name: 'Stands - Not Reviewed',
      active: true,
    },
    {
      id: 22,
      description_full: '',
      description_short: '',
      code: 'APS',
      name: 'Mandatory Amendment in Progress - Staff',
      active: true,
    },
    {
      id: 23,
      description_full: '',
      description_short: '',
      code: 'APA',
      name: 'Amendment in Progress - AH',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
