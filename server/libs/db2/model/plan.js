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
// Created by Jason Leach on 2018-05-10.
//

'use strict';

import { flatten } from 'lodash';
import GrazingSchedule from './grazingschedule';
import Model from './model';
import Pasture from './pasture';
import PlanExtension from './planextension';
import PlanStatus from './planstatus';
import MinisterIssue from './ministerissue';
import PlanStatusHistory from './planstatushistory';
import AmendmentConfirmation from './amendmentconfirmation';
import User from './user';

export default class Plan extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Plan.fields.indexOf(`${Plan.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.status = new PlanStatus(PlanStatus.extract(data));
    // The left join will return `null` values when no related record exists
    // so we manually exclude them.
    const extension = new PlanExtension(PlanExtension.extract(data));
    this.extension = extension.id === null ? null : extension;
    this.creator = new User(User.extract(data));
  }

  static get fields() {
    // TODO:(jl) Work with consumers to remove 'agreement_id' from the selected
    // fields.

    // primary key *must* be first!
    return [
      'id', 'range_name', 'plan_start_date', 'plan_end_date',
      'notes', 'alt_business_name', 'agreement_id', 'status_id',
      'uploaded', 'amendment_type_id', 'created_at', 'updated_at',
      'effective_at', 'submitted_at', 'creator_id',
    ].map(f => `${Plan.table}.${f}`);
  }

  static get table() {
    return 'plan';
  }

  static async findWithStatusExtension(
    db, where, order,
    page = undefined, limit = undefined, whereNot = undefined,
  ) {
    const myFields = [
      ...Plan.fields,
      ...PlanStatus.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...PlanExtension.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      let results = [];
      const q = db
        .select(myFields)
        .from(Plan.table)
        .join('ref_plan_status', { 'plan.status_id': 'ref_plan_status.id' })
        // left join otherwise if extension is NULL we don't get any results
        .leftJoin('extension', { 'plan.extension_id': 'extension.id' })
        .join('user_account', { 'plan.creator_id': 'user_account.id' })
        .where({ ...where, uploaded: true })
        .orderBy(...order);

      if (whereNot) {
        results = q.andWhere(...whereNot);
      }

      if (page && limit) {
        const offset = limit * (page - 1);
        results = await q
          .offset(offset)
          .limit(limit);
      } else {
        results = await q;
      }

      return results.map(row => new Plan(row, db));
    } catch (err) {
      throw err;
    }
  }

  // Fetch the Agreement ID associated with a given Plan
  static async agreementForPlanId(db, planId) {
    if (!db || !planId) {
      return [];
    }

    const results = await db
      .select('agreement_id')
      .from(Plan.table)
      .where({ id: planId });

    return flatten(results.map(result => Object.values(result))).pop();
  }

  async eagerloadAllOneToMany() {
    await this.fetchPastures();
    await this.fetchGrazingSchedules();
    await this.fetchMinisterIssues();
    await this.fetchPlanStatusHistory();
    await this.fetchAmendmentConfirmations();
  }

  async fetchAmendmentConfirmations() {
    const confirmations = await AmendmentConfirmation.find(
      this.db, { plan_id: this.id },
    );
    this.confirmations = confirmations || [];
  }

  async fetchPastures() {
    const where = { plan_id: this.id };
    const pastures = await Pasture.find(this.db, where);

    const promises = pastures.map(p =>
      [
        p.fetchPlantCommunities(this.db, { pasture_id: p.id }),
      ]);

    await Promise.all(flatten(promises));

    this.pastures = pastures || [];
  }

  async fetchGrazingSchedules() {
    const order = ['year', 'asc'];
    const where = { plan_id: this.id };
    const schedules = await GrazingSchedule.find(this.db, where, order);
    // egar load grazing schedule entries.
    const promises = schedules.map(s => s.fetchGrazingSchedulesEntries(
      this.db,
      {
        grazing_schedule_id: s.id,
      },
    ));
    await Promise.all(promises);

    this.grazingSchedules = schedules || [];
  }

  async fetchMinisterIssues() {
    const where = { plan_id: this.id };
    const ministerIssues = await MinisterIssue.findWithType(this.db, where);

    // eagar load pasture ids and minister issue actions.
    const promises = ministerIssues.map(i =>
      [
        i.fetchPastureIds(this.db, { minister_issue_id: i.id }),
        i.fetchMinisterIssueActions(this.db, { issue_id: i.id }),
      ]);

    await Promise.all(flatten(promises));

    this.ministerIssues = ministerIssues || [];
  }

  async fetchPlanStatusHistory() {
    const where = { plan_id: this.id };
    const planStatusHistory = await PlanStatusHistory.findWithUser(this.db, where);

    this.planStatusHistory = planStatusHistory || [];
  }
}
