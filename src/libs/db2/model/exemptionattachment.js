//
// MyRA
//
// Copyright © 2025 Province of British Columbia
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

/* eslint-env es6 */

'use strict';

import Model from './model';
import User from './user';

export default class ExemptionAttachment extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (ExemptionAttachment.fields.indexOf(`${ExemptionAttachment.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.user = new User(User.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'name', 'url', 'type', 'access', 'exemption_id', 'user_id', 'created_at', 'updated_at'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static get table() {
    return 'exemption_attachment';
  }

  /**
   * Find attachments for a specific exemption
   * @param {Object} trx - Database connection
   * @param {number} exemptionId - The exemption ID
   * @returns {Promise<Array>} Array of ExemptionAttachment instances
   */
  static async findByExemptionId(trx, exemptionId) {
    if (!trx || !exemptionId) {
      return [];
    }
    const fields = [...this.fields, ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`)];
    const results = await trx
      .select(fields)
      .from(this.table)
      .leftJoin(User.table, {
        [`${this.table}.user_id`]: `${User.table}.id`,
      })
      .where(`${this.table}.exemption_id`, exemptionId)
      .orderBy(`${this.table}.created_at`, 'asc');

    return results.map((row) => {
      return new ExemptionAttachment(row, trx);
    });
  }
}
