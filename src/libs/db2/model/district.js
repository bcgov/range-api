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

'use strict';

import Model from './model';

export default class District extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'code', 'description', 'user_id'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static async update(db, where, values) {
    const obj = {};
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });
    await db.table(this.table).where(where).update(obj);

    return [];
  }

  static async updateMultiple(db, where, values) {
    const obj = {};
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });
    await db.table(this.table).whereIn('id', where.ids).update(obj);

    return [];
  }

  static async removeDistricts(db, where) {
    const obj = {
      user_id: null,
    };
    await db.table(this.table).where('user_id', where.user_id).update(obj);

    return [];
  }

  static get table() {
    return 'ref_district';
  }
}
