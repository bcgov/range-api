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

import {
  calcDateDiff,
  calcPldAUMs,
  calcCrownAUMs,
  calcTotalAUMs,
  roundToSingleDecimalPlace,
} from '../../../router/helpers/PDFHelper';
import LivestockType from './livestocktype';
import Model from './model';
import Pasture from './pasture';

export default class GrazingScheduleEntry extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (
        GrazingScheduleEntry.fields.indexOf(
          `${GrazingScheduleEntry.table}.${key}`,
        ) > -1
      ) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.livestockType = new LivestockType(LivestockType.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'grace_days',
      'livestock_count',
      'date_in',
      'date_out',
      'pasture_id',
      'livestock_type_id',
      'grazing_schedule_id',
      'canonical_id',
      'created_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'grazing_schedule_entry';
  }

  static async findWithLivestockType(
    db,
    where,
    order,
    orderRaw,
    page = undefined,
    limit = undefined,
  ) {
    const myFields = [
      ...GrazingScheduleEntry.fields,
      ...LivestockType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...Pasture.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];
    try {
      let results = [];
      const q = db
        .select(myFields)
        .from(GrazingScheduleEntry.table)
        .join('ref_livestock', {
          'grazing_schedule_entry.livestock_type_id': 'ref_livestock.id',
        })
        .join('pasture', { 'grazing_schedule_entry.pasture_id': 'pasture.id' })
        .where(where);

      if (orderRaw) {
        q.orderByRaw(order);
      } else if (order) q.orderBy(...order);

      q.orderBy('grazing_schedule_entry.updated_at', 'asc');

      if (page && limit) {
        const offset = limit * (page - 1);
        results = await q.offset(offset).limit(limit);
      } else {
        results = await q;
      }
      return results;
    } catch (err) {
      throw err;
    }
  }
}
