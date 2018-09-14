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
      username: 'rangestaff',
      given_name: 'Range',
      family_name: 'Staff',
      email: 'amir+1@freshworks.io',
      active: true,
    },
    {
      username: 'rangeadmin',
      given_name: 'Range',
      family_name: 'Admin',
      email: 'kyubin+1@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\kyubinhan711',
      given_name: 'Kyub',
      family_name: 'Han',
      email: 'kyubin@freshworks.io',
      active: true,
    },
    {
      username: 'shellhan',
      given_name: 'Shelly',
      family_name: 'Han',
      email: 'shelly+1@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\jasoncleach',
      given_name: 'Jason',
      family_name: 'Leach',
      email: 'jason.leach@fullboar.ca',
      active: true,
    },
    {
      username: 'bceid\\myraah1',
      given_name: 'Agreement Holder 1',
      family_name: 'Range',
      email: 'roop@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\phillbillips',
      given_name: 'Phill',
      family_name: 'Billips',
      email: 'pb@example.com',
      active: true,
    },
    {
      username: 'bceid\\myraah2',
      given_name: 'Agreement Holder2',
      family_name: 'Range',
      email: 'amir@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\ah1',
      given_name: 'Myra',
      family_name: 'Myra',
      email: 'shellshell456@gmail.com',
      active: true,
    },
    {
      username: 'bceid\\testah1',
      given_name: 'Test',
      family_name: 'AgreementHolder1',
      email: 'roop.1@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah2',
      given_name: 'Test',
      family_name: 'AgreementHolder2',
      email: 'roop.2@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah3',
      given_name: 'Test',
      family_name: 'AgreementHolder3',
      email: 'roop.3@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah4',
      given_name: 'Test',
      family_name: 'AgreementHolder4',
      email: 'roop.4@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah5',
      given_name: 'Test',
      family_name: 'AgreementHolder5',
      email: 'roop.5@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah6',
      given_name: 'Test',
      family_name: 'AgreementHolder6',
      email: 'roop.6@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\testah7',
      given_name: 'Test',
      family_name: 'AgreementHolder7',
      email: 'roop.7@freshworks.io',
      active: true,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};