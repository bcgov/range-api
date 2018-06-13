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

const table = 'user_account';

exports.seed = async (knex) => {
  const ref = [
    {
      username: 'myra2',
      given_name: 'Range',
      family_name: 'MyRA2',
      email: 'range_myra_2@example.com',
    },
    {
      username: 'myra1',
      given_name: 'Range',
      family_name: 'MyRA1',
      email: 'range_myra_1@example.com',
    },
    {
      username: 'bceid\\kyubinhan711',
      given_name: 'Kyub',
      family_name: 'Han',
      email: 'kyubin@freshworks.io',
    },
    {
      username: 'shellhan',
      given_name: 'Shelly',
      family_name: 'Han',
      email: 'shelly+1@freshworks.io',
    },
    {
      username: 'bceid\\jasoncleach',
      given_name: 'Jason',
      family_name: 'Leach',
      email: 'jason.leach@fullboar.ca',
    },
    {
      username: 'bceid\\myraah1',
      given_name: 'Agreement Holder 1',
      family_name: 'Range',
      email: 'roop@freshworks.io',
    },
    {
      username: 'bceid\\phillbillips',
      given_name: 'Phill',
      family_name: 'Billips',
      email: 'pb@example.com',
    },
    {
      username: 'bceid\\myraah2',
      given_name: 'Agreement Holder2',
      family_name: 'Range',
      email: 'amir@freshworks.io',
    },
    {
      username: 'bceid\\ah1',
      given_name: 'Myra',
      family_name: 'Myra',
      email: 'shellshell456@gmail.com',
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
