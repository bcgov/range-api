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

'use strict';

/* eslint-disable no-unused-vars */

exports.up = async (knex) => {
  // Drop the existing check constraint
  await knex.raw(`
    ALTER TABLE plant_community 
    DROP CONSTRAINT plant_community_purpose_of_action_check
  `);

  // Add the new check constraint with the 'improve' value
  await knex.raw(`
    ALTER TABLE plant_community 
    ADD CONSTRAINT plant_community_purpose_of_action_check 
    CHECK (purpose_of_action IN ('establish', 'maintain', 'improve', 'none'))
  `);
};

exports.down = async (knex) => {
  // Drop the updated check constraint
  await knex.raw(`
    ALTER TABLE plant_community 
    DROP CONSTRAINT plant_community_purpose_of_action_check
  `);

  // Restore the original check constraint
  await knex.raw(`
    ALTER TABLE plant_community 
    ADD CONSTRAINT plant_community_purpose_of_action_check 
    CHECK (purpose_of_action IN ('establish', 'maintain', 'none'))
  `);
};
