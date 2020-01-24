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

import Model from './model';
import MinisterIssueType from './ministerissuetype';
import MinisterIssueAction from './ministerissueaction';
import MinisterIssuePasture from './ministerissuepasture';

export default class MinisterIssue extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (MinisterIssue.fields.indexOf(`${MinisterIssue.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.ministerIssueType = new MinisterIssueType(MinisterIssueType.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'objective', 'identified', 'issue_type_id', 'plan_id', 'canonical_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'minister_issue';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...MinisterIssue.fields,
      ...MinisterIssueType.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(MinisterIssue.table)
        .join('ref_minister_issue_type', { 'minister_issue.issue_type_id': 'ref_minister_issue_type.id' })
        .where(where)
        .orderBy('minister_issue.created_at', 'asc');

      return results.map(row => new MinisterIssue(row, db));
    } catch (err) {
      throw err;
    }
  }

  async fetchMinisterIssueActions(db, where) {
    const ministerIssueActions = await MinisterIssueAction.findWithType(db, where);
    this.ministerIssueActions = ministerIssueActions || [];
  }

  async fetchPastureIds(db, where) {
    const pastures = await db
      .select('pasture_id')
      .from(MinisterIssuePasture.table)
      .where(where);

    // create an array of pasture ids
    const pastureIds = pastures.map(p => p.pasture_id);
    this.pastures = pastureIds || [];
  }
}
