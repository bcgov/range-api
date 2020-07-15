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
// Created by Jason Leach on 2018-05-04.
//

/* eslint-env es6 */

'use strict';

import { flatten } from 'lodash';
import District from './district';
import Model from './model';
import User from './user';

export default class Zone extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Zone.fields.indexOf(`${Zone.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.district = new District(District.extract(data));

    this.user = data.user_id ? new User(User.extract(data)) : null;
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'code', 'description', 'district_id', 'user_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'ref_zone';
  }

  static async searchForTerm(db, term) {
    if (!db || !term) {
      return [];
    }

    const results = await db
      .select(`${Zone.table}.${Zone.primaryKey}`)
      .from(Zone.table)
      .join('user_account', { 'ref_zone.user_id': 'user_account.id' })
      .whereRaw(`user_account.given_name || ' ' || user_account.family_name ILIKE '%${term}%'`);

    // return an array of `zone_id`
    return flatten(results.map(result => Object.values(result)));
  }

  static async findWithDistrictUser(db, where) {
    const myFields = [
      ...Zone.fields,
      ...District.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(Zone.table)
        .join('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
        .leftJoin('user_account', { 'ref_zone.user_id': 'user_account.id' })
        .where(where)
        .orderBy('ref_zone.user_id', 'desc');

      return results.map(row => new Zone(row, db));
    } catch (err) {
      throw err;
    }
  }
}
