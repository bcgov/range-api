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

const table = 'ref_minister_issue_action_type';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Herding',
      placeholder: 'Frequency, distance and direction livestock will be herded. Identify the high pressure area and/or lower use areas if relevant. Ex. livestock will be herded at least 1 km away from Fish Lake towards the north 3 times per week.',
      active: true,
    },
    {
      name: 'Livestock Variables',
      placeholder: 'Type and/or age of livestock to be used to address the issue. If necessary update the grazing schedule to reflect the livestock type. Ex. calves will be 5 months or older before grazing in the riparian area.',
      active: true,
    },
    {
      name: 'Salting',
      placeholder: 'Location and timing of salting using an identifiable location and a distance in metres. Ex. remove salt from the NE station (on map) after July 1st.',
      active: true,
    },
    {
      name: 'Supplemental Feeding',
      placeholder: 'Type, location and time frame of supplemental feed. Ex. locate protein tub in the south east block in the Pine pasture during the fall rotation.',
      active: true,
    },
    {
      name: 'Timing',
      placeholder: 'How livestock use will be timed. Complete the dates for the no grazing window and update the schedule as needed.  Ex. rest the Owl pasture every other year.',
      active: true,
    },
    {
      name: 'Other',
      placeholder: 'Describe the action to be taken including what, where and when.',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
