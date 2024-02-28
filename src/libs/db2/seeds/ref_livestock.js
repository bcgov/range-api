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
// Created by Jason Leach on 2018-05-28.
//

/* eslint-disable no-param-reassign, arrow-body-style */

'use strict';

const table = 'ref_livestock';

exports.seed = async (knex) => {
  // order matters !!!
  const ref = [
    {
      name: 'Cow with Calf',
      au_factor: 1,
      active: true,
    },
    {
      name: 'Bull',
      au_factor: '1.5',
      active: true,
    },
    {
      name: 'Yearling',
      au_factor: 0.7,
      active: true,
    },
    {
      name: 'Horse',
      au_factor: 1.25,
      active: true,
    },
    {
      name: 'Sheep',
      au_factor: 0.2,
      active: true,
    },
    {
      name: 'Alpaca',
      au_factor: 0.1,
      active: true,
    },
    {
      name: 'Ass',
      au_factor: 1.25,
      active: true,
    },
    {
      name: 'Goat',
      au_factor: 0.2,
      active: true,
    },

    {
      name: 'Llama',
      au_factor: 0.2,
      active: true,
    },
    {
      name: 'Mule',
      au_factor: 1.25,
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);

  await knex.schema.raw(
    `ALTER SEQUENCE ${table}_id_seq RESTART WITH ${ref.length};`,
  );
};
