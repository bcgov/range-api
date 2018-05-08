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
// Created by Jason Leach on 2018-05-07.
//

/* eslint-env es6 */

'use strict';

export default class Model {
  constructor(data) {
    Object.assign(this, Model.transformToCamelCase(data));
  }

  static get fields() {
    // primary key *must* be first!
    throw new Error('You must override this fields()');
  }

  static get table() {
    throw new Error('You must override this table()');
  }

  static get primaryKey() {
    return this.fields[0].split('.')[1];
  }

  static transformToCamelCase(data) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      obj[Model.toCamelCase(key)] = data[key];
    });

    return obj;
  }

  static toCamelCase(str) {
    return str.replace(/_/g, ' ').replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => { // eslint-disable-line arrow-body-style
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    }).replace(/\s+/g, '');
  }

  static toSnakeCase(str) {
    return str.replace(/([A-Z])/g, $1 => `_${$1.toLowerCase()}`);
  }

  // Find an object(s) with the provided where conditions
  static async find(db, ...where) {
    return db.table(this.table)
      .where(...where)
      .select(...this.fields)
      .then(rows => rows.map((row) => {
        const obj = Object.create(this.prototype);
        Object.assign(obj, this.transformToCamelCase(row));

        return obj;
      }));
  }

  static async findOne(db, ...where) {
    return (await this.find(db, ...where)).pop();
  }

  static async findById(db, id) {
    const where = {};
    where[this.primaryKey] = id;
    return this.findOne(db, where);
  }

  static async update(db, where, values) {
    const obj = { ...values, ...{} };
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const results = await db
        .table(this.table)
        .where(where)
        .update(obj)
        .returning(this.primaryKey);

      return results;
    } catch (err) {
      throw err;
    }
  }

  // extract a models properties from the given data
  static extract(data) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      const prefix = this.table;
      if (key.startsWith(prefix)) {
        const aKey = key.replace(prefix, '').slice(1);
        obj[aKey] = data[key];
      }
    });

    return obj;
  }
}
