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
// Created by Kyubin Han on 2018-08-21.
//

/* eslint-env es6 */

'use strict';

import Model from './model';
import User from './user';

export default class PlanStatusHistory extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlanStatusHistory.fields.indexOf(`${PlanStatusHistory.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.user = new User(User.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'plan_id', 'from_plan_status_id', 'to_plan_status_id',
      'user_id', 'note', 'created_at', 'updated_at',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plan_status_history';
  }

  static async findWithUser(db, where) {
    const myFields = [
      ...PlanStatusHistory.fields,
      ...User.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(PlanStatusHistory.table)
        .join('user_account', { 'plan_status_history.user_id': 'user_account.id' })
        .where(where)
        .orderBy('id', 'asc');

      return results.map(row => new PlanStatusHistory(row, db));
    } catch (err) {
      throw err;
    }
  }
}
