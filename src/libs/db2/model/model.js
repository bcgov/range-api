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
  constructor(data, db = undefined) {
    // this hides `db` from for..in.
    Object.defineProperty(this, 'db', {
      enumerable: false,
      value: db,
      writable: false,
    });

    Object.assign(this, Model.transformToCamelCase(data));
  }

  static get fields() {
    // primary key *must* be first!
    throw new Error('You must override fields()');
  }

  static get table() {
    throw new Error('You must override table()');
  }

  // // eslint-disable-next-line no-unused-vars
  // static async find(db, where, order = undefined) {
  //   throw new Error('You must override find()');
  // }

  static get primaryKey() {
    const field = this.fields[0];
    return field.indexOf('.') > -1 ? field.slice(field.indexOf('.') + 1) : field;
  }

  static transformToCamelCase(data) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      obj[Model.toCamelCase(key)] = data[key];
    });

    return obj;
  }

  static toCamelCase(str) {
    return str
      .replace(/_/g, ' ')
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
        // eslint-disable-line arrow-body-style
        return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  static toSnakeCase(str) {
    return str.replace(/([A-Z])/g, ($1) => `_${$1.toLowerCase()}`);
  }

  // Find an object(s) with the provided where conditions
  static async find(db, where, order = undefined) {
    let results = [];
    const q = db.table(this.table).select(...this.fields);
    // Enhanced: handle arrays in any where key (not just single-key case)
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        q.whereIn(k, v);
      } else {
        q.where(k, v);
      }
    });

    if (order && order.length > 0) {
      results = await q.orderBy(...order);
    } else {
      // console.log(q.toSQL().toNative());
      results = await q;
    }

    const objs = results.map((row) => {
      const obj = Object.create(this.prototype, {
        db: {
          enumerable: false,
          value: db,
          writable: false,
        },
      });
      Object.assign(obj, this.transformToCamelCase(row));

      return obj;
    });

    return objs;
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
    // Only the keys returned by the `fields` getter can
    // be updated (by default). Override for different behaviour.
    const obj = {};
    this.fields
      .slice(1) // skip the PK, they can not be updated.
      .forEach((key) => {
        const aKey = key.split('.').pop();
        // check for both camel case and snake case values
        if (values[Model.toCamelCase(aKey)] !== undefined) {
          obj[aKey] = values[Model.toCamelCase(aKey)];
        }
        if (values[aKey] !== undefined) {
          obj[aKey] = values[aKey];
        }
      });
    const results = await db.table(this.table).where(where).update(obj).returning(this.primaryKey);
    if (results.length > 0) return await this.findById(db, results.pop());
    return [];
  }

  static async count(db, where = {}) {
    const q = db.table(this.table).count('*');

    if (Object.keys(where).length === 1 && where[Object.keys(where)[0]].constructor === Array) {
      const k = Object.keys(where)[0];
      const v = where[k];
      q.whereIn(k, v);
    } else {
      q.where(where);
    }

    const results = await q;
    if (results.length === 0) {
      return 0;
    }

    const count = parseInt(results.pop().count, 10);
    return !Number.isNaN(count) ? count : 0;
  }

  /**
   * Sets `canonical_id` to the value of `canonical_id` || `id`
   * @param {*} db - knex database object
   * @param {number} id - ID of the row to update
   */
  static async setCanonicalId(db, id) {
    const data = await this.findById(db, id);
    return this.update(db, { id }, { canonical_id: data.canonical_id || data.id });
  }

  static async create(db, values) {
    const fields = this.fields.map((f) => f.split('.')[1]);
    // Only the keys returned by the `fields` getter can
    // be used to create a new record (by default). Override for
    // different behaviour.
    const obj = {};
    this.fields.forEach((key) => {
      const aKey = key.split('.').pop();
      // check for both camel case and snake case values
      if (values[Model.toCamelCase(aKey)]) {
        obj[aKey] = values[Model.toCamelCase(aKey)];
      }
      if (values[aKey]) {
        obj[aKey] = values[aKey];
      }
    });

    const results = await db.table(this.table).returning(this.primaryKey).insert(obj);

    if (fields.includes('canonical_id') && !(values.canonicalId || values.canonical_id)) {
      await this.setCanonicalId(db, results[0]);
    }
    return await this.findById(db, results.pop());
  }

  static async removeById(db, id) {
    const where = {};
    where[this.primaryKey] = id;

    return this.remove(db, where);
  }

  static async remove(db, where) {
    const results = await db.table(this.table).where(where).delete();

    return results;
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
