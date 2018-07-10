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
  }

  static get fields() {
    // TODO:(jl) Work with consumers to remove 'agreement_id' from the selected
    // fields.

    // primary key *must* be first!
    return ['id', 'range_name', 'plan_start_date', 'plan_end_date', 'notes', 'alt_business_name',
      'agreement_id', 'status_id', 'uploaded', 'created_at', 'updated_at'].map(f => `${Plan.table}.${f}`);
  }

  static get table() {
    return 'plan';
  }

  static async findLatestWithStatusExtension(db, where) {
    const order = ['id', 'desc'];
    const page = 1;
    const limit = 1;
    const plan = await this.findWithStatusExtension(db, where, order, page, limit);
    return plan;
  }

  static async findWithStatusExtension(db, where, order, page = undefined, limit = undefined) {
    const myFields = [
      ...Plan.fields,
      ...PlanStatus.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...PlanExtension.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      let results = [];
      const q = db
        .select(myFields)
        .from(Plan.table)
        .join('ref_plan_status', { 'plan.status_id': 'ref_plan_status.id' })
        // left join otherwise if extension is NULL we don't get any results
        .leftJoin('extension', { 'plan.extension_id': 'extension.id' })
        .where({ ...where, uploaded: true })
        .orderBy(...order);

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

  // static async update(db, where, values) {
  //   const obj = { ...values, ...{} };
  //   Object.keys(values).forEach((key) => {
  //     obj[Model.toSnakeCase(key)] = values[key];
  //   });

  //   try {
  //     const results = await db
  //       .table(Plan.table)
  //       .where(where)
  //       .update(obj)
  //       .returning(this.primaryKey);
  //     const promises = results.map(result =>
  //       Plan.findWithTypeZoneDistrict(db, { forest_file_id: result }));

  //     return Promise.all(promises);
  //   } catch (err) {
  //     throw err;
  //   }
  // }

  async eagerloadAllOneToMany() {
    await this.fetchPastures();
    await this.fetchGrazingSchedules();
    await this.fetchMinisterIssues();
  }

  async fetchPastures() {
    const where = { plan_id: this.id };
    const pastures = await Pasture.find(this.db, where);
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
}
