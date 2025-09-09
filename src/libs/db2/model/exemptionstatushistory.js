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

export default class ExemptionStatusHistory extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'agreement_id',
      'exemption_status_id',
      'start_date',
      'end_date',
      'reason',
      'justification_text',
      'user_id',
      'created_at',
      'updated_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'exemption_status_history';
  }

  /**
   * Find exemption history records for a specific agreement
   * @param {Object} db - Database connection
   * @param {string} agreementId - The agreement forest file ID
   * @param {Object} options - Query options (orderBy, limit, etc.)
   * @returns {Array} Array of ExemptionStatusHistory instances
   */
  static async findByAgreementId(db, agreementId, options = {}) {
    if (!db || !agreementId) {
      return [];
    }

    let query = db
      .select([
        ...this.fields,
        'ref_agreement_exemption_status.code as exemption_status_code',
        'ref_agreement_exemption_status.description as exemption_status_description',
        'user_account.given_name',
        'user_account.family_name',
      ])
      .from(this.table)
      .leftJoin('ref_agreement_exemption_status', {
        [`${this.table}.exemption_status_id`]: 'ref_agreement_exemption_status.id',
      })
      .leftJoin('user_account', {
        [`${this.table}.user_id`]: 'user_account.id',
      })
      .where(`${this.table}.agreement_id`, agreementId);

    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc');
    } else {
      query = query.orderBy(`${this.table}.created_at`, 'desc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query;
    return results.map((row) => new ExemptionStatusHistory(row, db));
  }

  /**
   * Find active exemptions for an agreement at a specific date
   * @param {Object} db - Database connection
   * @param {string} agreementId - The agreement forest file ID
   * @param {Date} date - The date to check (defaults to current date)
   * @returns {Array} Array of active ExemptionStatusHistory instances
   */
  static async findActiveExemptions(db, agreementId, date = new Date()) {
    if (!db || !agreementId) {
      return [];
    }

    const results = await db
      .select([
        ...this.fields,
        'ref_agreement_exemption_status.code as exemption_status_code',
        'ref_agreement_exemption_status.description as exemption_status_description',
      ])
      .from(this.table)
      .leftJoin('ref_agreement_exemption_status', {
        [`${this.table}.exemption_status_id`]: 'ref_agreement_exemption_status.id',
      })
      .where(`${this.table}.agreement_id`, agreementId)
      .where(`${this.table}.start_date`, '<=', date)
      .where(`${this.table}.end_date`, '>=', date)
      .orderBy(`${this.table}.start_date`, 'desc');

    return results.map((row) => new ExemptionStatusHistory(row, db));
  }
}
