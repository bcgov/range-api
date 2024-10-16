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

import AmendmentType from './amendmenttype';
import Model from './model';
import Plan from './plan';
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
    return [
      'id',
      'plan_id',
      'from_plan_status_id',
      'to_plan_status_id',
      'user_id',
      'note',
      'created_at',
      'updated_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'plan_status_history';
  }

  static async findWithUser(db, where) {
    const myFields = [...PlanStatusHistory.fields, ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`)];

    const results = await db
      .select(myFields)
      .from(PlanStatusHistory.table)
      .join('user_account', {
        'plan_status_history.user_id': 'user_account.id',
      })
      .where(where)
      .orderBy('created_at', 'desc');

    return results.map((row) => new PlanStatusHistory(row, db));
  }

  static async fetchOriginalApproval(db, planId) {
    const approvalDetails = await db
      .select(['plan_status_history.created_at', 'user_account.family_name', 'user_account.given_name'])
      .table('plan_status_history')
      .leftJoin('user_account', {
        'plan_status_history.user_id': 'user_account.id',
      })
      .whereIn('to_plan_status_id', Plan.legalStatuses)
      .andWhere({
        plan_id: planId,
      })
      .orderBy('plan_status_history.created_at')
      .first();
    if (approvalDetails) {
      return {
        createdAt: approvalDetails.created_at,
        familyName: approvalDetails.family_name,
        givenName: approvalDetails.given_name,
      };
    }
    return null;
  }

  static async fetchAmendmentSubmissions(db, planId, startDate) {
    const amendmentTypeArray = [];
    const amendmentTypeRows = await AmendmentType.find(db, {});
    amendmentTypeRows.forEach((element) => {
      amendmentTypeArray[element.id] = element.description;
    });
    const results = await db
      .select([
        'plan_status_history.id',
        'plan_status_history.to_plan_status_id',
        'plan_status_history.from_plan_status_id',
        'plan_status_history.created_at',
        'user_account.family_name',
        'user_account.given_name',
      ])
      .table('plan_status_history')
      .leftJoin('user_account', {
        'plan_status_history.user_id': 'user_account.id',
      })
      .andWhere({
        plan_id: planId,
      })
      .orderBy('plan_status_history.created_at');
    const response = [];
    let lastMandatoryAmendment = null;
    results.forEach((row) => {
      if (
        startDate &&
        new Date(startDate) < new Date(row.created_at) &&
        new Date(startDate).toString() !== new Date(row.created_at).toString()
      ) {
        return;
      }
      if (row.to_plan_status_id === 21) {
        response.push({
          id: row.id,
          createdAt: row.created_at,
          submittedBy: `${row.given_name} ${row.family_name}`,
          approvedAt: null,
          approvedBy: null,
          amendmentType: amendmentTypeArray[1],
        });
      } else if (row.from_plan_status_id === 22 || row.from_plan_status_id === 23) {
        lastMandatoryAmendment = response.length;
        response.push({
          id: row.id,
          createdAt: row.created_at,
          submittedBy: `${row.given_name} ${row.family_name}`,
          approvedAt: null,
          approvedBy: null,
          amendmentType: amendmentTypeArray[2],
        });
      }
      if (Plan.legalStatuses.indexOf(row.to_plan_status_id) !== -1) {
        if (lastMandatoryAmendment !== null) {
          response[lastMandatoryAmendment].approvedBy = `${row.given_name} ${row.family_name}`;
          response[lastMandatoryAmendment].approvedAt = row.created_at;
        }
      }
    });
    return response.reverse();
  }
}
