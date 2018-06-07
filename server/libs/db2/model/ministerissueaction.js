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
// Created by Jason Leach on 2018-06-01.
//

/* eslint-env es6 */

'use strict';

import MinisterIssueActionType from './ministerissueactiontype';
import Model from './model';

export default class MinisterIssueAction extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (MinisterIssueAction.fields.indexOf(`${MinisterIssueAction.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.ministerIssueActionType =
      new MinisterIssueActionType(MinisterIssueActionType.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'action_type_id', 'issue_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'minister_issue_action';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...MinisterIssueAction.fields,
      ...MinisterIssueActionType.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(MinisterIssueAction.table)
        .join('ref_minister_issue_action_type', { 'minister_issue_action.action_type_id': 'ref_minister_issue_action_type.id' })
        .where(where)
        .orderBy('id', 'asc');

      return results.map(row => new MinisterIssueAction(row, db));
    } catch (err) {
      throw err;
    }
  }
}
