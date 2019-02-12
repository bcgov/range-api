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
// Created by Kyubin Han on 2018-06-13.
//

/* eslint-disable no-param-reassign */

'use strict';

const table = 'version';

exports.seed = async (knex) => {
  const ref = [
    {
      ios: 3009,
      idp_hint: '',
      api: 1,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
