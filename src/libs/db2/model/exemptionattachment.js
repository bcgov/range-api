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

export default class ExemptionAttachment extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'name', 'url', 'type', 'access', 'exemption_history_id', 'user_id', 'created_at', 'updated_at'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static get table() {
    return 'exemption_attachment';
  }

  /**
   * Find attachments for a specific exemption history record
   * @param {Object} db - Database connection
   * @param {number} exemptionHistoryId - The exemption history ID
   * @returns {Array} Array of ExemptionAttachment instances
   */
  static async findByExemptionHistoryId(db, exemptionHistoryId) {
    if (!db || !exemptionHistoryId) {
      return [];
    }

    const results = await db
      .select([...this.fields, 'user_account.given_name', 'user_account.family_name'])
      .from(this.table)
      .leftJoin('user_account', {
        [`${this.table}.user_id`]: 'user_account.id',
      })
      .where(`${this.table}.exemption_history_id`, exemptionHistoryId)
      .orderBy(`${this.table}.created_at`, 'asc');

    return results.map((row) => new ExemptionAttachment(row, db));
  }
}
