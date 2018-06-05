
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
// Created by Jason Leach on 2018-06-05.
//

'use strict';

exports.up = async (knex) => {
  const query = `
  ALTER TABLE minister_issue_action 
  DROP CONSTRAINT minister_issue_action_issue_id_foreign, 
  ADD CONSTRAINT minister_issue_action_issue_id_foreign 
  FOREIGN KEY (issue_id) REFERENCES minister_issue(id) 
  ON DELETE CASCADE;
  `;

  await knex.schema.raw(query);
};

exports.down = () => { };
