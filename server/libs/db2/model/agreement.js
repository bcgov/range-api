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

import District from './district';
import Model from './model';
import Zone from './zone';

export default class Agreement extends Model {
  constructor(data) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Agreement.fields.indexOf(`${Agreement.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });
    super(obj);
    this.zone = new Zone(Model.extract(data, Zone));
    this.district = new District(Model.extract(data, District));
  }

  static get fields() {
    return ['forest_file_id', 'agreement_start_date', 'agreement_end_date', 'agreement_type_id',
      'agreement_exemption_status_id'].map(f => `${Agreement.table}.${f}`);
  }

  static get table() {
    return 'agreement';
  }

  static async find(db, ...where) {
    return db.table(Agreement.table)
      .where(...where)
      .select(...Agreement.fields)
      .then(rows => rows.map(row => new Agreement(row)));
  }

  static async findWithZoneAndDistrict(db, ...where) {
    const myFields = [
      ...Agreement.fields,
      ...Zone.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...District.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    return db
      .select(myFields)
      .from(Agreement.table)
      .join('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .join('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
      .where(...where)
      .then(rows => rows.map(row => new Agreement(row)));
  }
}
