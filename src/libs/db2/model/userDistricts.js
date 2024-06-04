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

export default class UserDistricts extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'code', 'description', 'user_id'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static async createOneOrMany(db, values) {
    const id = values.user_id;
    const districts = values.districts;
    const objs = [];

    districts.forEach((district) => {
      const obj = {};
      Object.keys(district).forEach((key) => {
        obj[Model.toSnakeCase(key)] = district[key];
      });
      obj["user_id"] = id;
      objs.push(obj);
    });

    const count = await db.table(this.table).insert(objs);

    return [];
  }

  static async removeDistricts(db, where) {
    const count = await db.table(this.table).where("user_id", where.user_id).del();

    return [];
  }

  static get table() {
    return 'user_districts';
  }
}
