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
      email: 'kyubinbceid@freshworks.io',
      active: true,
    },
    {
      username: 'idir\\khan',
      given_name: 'Kyubin',
      family_name: 'Han',
      email: 'kyubin@freshworks.io',
      active: true,
    },
    {
      username: 'bceid\\nackyu711',
      given_name: 'han',
      family_name: 'Han Nackyu',
      email: 'nackyu711@gmail.com',
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
      username: 'bceid\\leslie.knope',
      given_name: 'Leslie',
      family_name: 'Knope',
      email: 'leslie.knope@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\ron.swanson',
      given_name: 'Ron',
      family_name: 'Swanson',
      email: 'ron.swanson@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\tom.haverford',
      given_name: 'Tom',
      family_name: 'Haverford',
      email: 'tom.haverford@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\andy.dwyer',
      given_name: 'Andy',
      family_name: 'Dwyer',
      email: 'andy.dwyer@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\april.ludgate',
      given_name: 'April',
      family_name: 'Ludgate',
      email: 'april.ludgate@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\ann.perkins',
      given_name: 'Ann',
      family_name: 'Perkins',
      email: 'ann.perkins@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\ben.wyatt',
      given_name: 'Ben',
      family_name: 'Wyatt',
      email: 'ben.wyatt@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'bceid\\chris.traeger',
      given_name: 'Chris',
      family_name: 'Traeger',
      email: 'chris.traeger@myrangebc.gov.bc.ca',
      active: true,
    },
    {
      username: 'idir\\lmoore',
      given_name: 'Lisa',
      family_name: 'Moore',
      email: 'lisa.moore@gov.bc.ca',
      active: true,
    },
    {
      username: 'idir\\kmenke',
      given_name: 'Katie',
      family_name: 'Menke',
      email: 'katie.menke@gov.bc.ca',
      active: true,
    },
  ];

  await knex(table).delete();
  await knex(table).insert(ref);
};
