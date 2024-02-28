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
// Created by Jason Leach on 2018-05-08.
//

/* eslint-env es6 */

'use strict';

import { flatten } from 'lodash';
import ClientType from './clienttype';
import Model from './model';

export default class Client extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Client.fields.indexOf(`${Client.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.clientType = new ClientType(ClientType.extract(data), db);
  }

  // To match previous Agreement (sequelize) schema.
  get id() {
    return this.clientNumber;
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'client_number',
      'location_codes',
      'name',
      'licensee_start_date',
      'licensee_end_date',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'ref_client';
  }

  static async clientsForAgreement(db, agreement) {
    if (!db || !agreement) {
      return [];
    }

    const myFields = [
      ...Client.fields,
      ...ClientType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];

    const results = await db
      .select(myFields)
      .from(Client.table)
      .join('client_agreement', {
        'client_agreement.client_id': 'ref_client.client_number',
      })
      .join('ref_client_type', {
        'client_agreement.client_type_id': 'ref_client_type.id',
      })
      .where({ 'client_agreement.agreement_id': agreement.forestFileId });

    const clients = results.map((row) => new Client(row));

    return clients;
  }

  static async searchForTerm(db, term) {
    if (!db || !term) {
      return [];
    }

    const results = await db
      .select(Client.primaryKey)
      .from(Client.table)
      .whereRaw(`name ILIKE '%${term}%'`);

    // return an array of `client_number`
    return flatten(results.map((result) => Object.values(result)));
  }

  static async searchByNameWithAllFields(db, term) {
    if (!db) {
      return [];
    }

    const results = await db
      .select()
      .from(Client.table)
      .where('name', 'ilike', `%${term}%`);

    const clients = results.map((row) => new Client(row));

    return clients;
  }
}
