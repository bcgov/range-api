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
// Created by Jason Leach on 2018-05-10.
//

'use strict';
import Model from './model';
import Pasture from './pasture';

export default class HayCuttingScheduleEntry extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (HayCuttingScheduleEntry.fields.indexOf(`${HayCuttingScheduleEntry.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });
    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'date_in',
      'date_out',
      'pasture_id',
      'stubble_height',
      'tonnes',
      'haycutting_schedule_id',
      'canonical_id',
      'created_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'haycutting_schedule_entry';
  }

  static async findWithOrder(db, where, order, orderRaw, page = undefined, limit = undefined) {
    const myFields = [
      ...HayCuttingScheduleEntry.fields,
      ...Pasture.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];
    let results = [];
    const q = db
      .select(myFields)
      .from(HayCuttingScheduleEntry.table)
      .join('pasture', { 'haycutting_schedule_entry.pasture_id': 'pasture.id' })
      .where(where);

    if (orderRaw) {
      q.orderByRaw(order);
    } else if (order) q.orderBy(...order);

    q.orderBy('haycutting_schedule_entry.id', 'asc');

    if (page && limit) {
      const offset = limit * (page - 1);
      results = await q.offset(offset).limit(limit);
    } else {
      results = await q;
    }
    return results;
  }
}
