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
// Created by Jason Leach on 2018-05-04.
//

'use strict';

/* eslint-disable max-len */

import { flatten } from 'lodash';
import AgreementExemptionStatus from './agreementexemptionstatus';
import AgreementType from './agreementtype';
import Client from './client';
import District from './district';
import LivestockIdentifier from './livestockidentifier';
import Model from './model';
import Plan from './plan';
import Usage from './usage';
import User from './user';
import Zone from './zone';
import { PLAN_STATUS } from '../../../constants';
import PlanStatus from './planstatus';

export default class Agreement extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Agreement.fields.indexOf(`${Agreement.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    // // hide this property so it is not automatically returned by the
    // // API.
    // delete this.forestFileId;
    // Object.defineProperty(this, 'forestFileId', {
    //   value: obj.forestFileId,
    //   writable: false,
    //   enumerable: false,
    // });

    this.zone = new Zone(Zone.extract(data));
    this.zone.district = new District(District.extract(data));
    this.zone.user = new User(User.extract(data));
    this.agreementType = new AgreementType(AgreementType.extract(data));
    // eslint-disable-next-line max-len
    this.agreementExemptionStatus = new AgreementExemptionStatus(AgreementExemptionStatus.extract(data));
  }

  // To matche previous Agreement (sequelize) schema.
  get id() {
    return this.forestFileId;
  }

  static get fields() {
    // primary key *must* be first!
    return ['forest_file_id', 'agreement_start_date', 'agreement_end_date', 'zone_id', 'agreement_exemption_status_id', 'agreement_type_id'].map(f => `${Agreement.table}.${f}`);
  }

  static get table() {
    return 'agreement';
  }

  static async findWithAllRelations(...args) {
    // Destructuring rest parameters(orders still matter when passing parameters!)
    const [
      db,
      where,
      page = undefined,
      limit = undefined,
      latestPlan = false,
      sendFullPlan = false,
      staffDraft = false,
      orderBy = 'agreement.forest_file_id',
      order = 'asc',
    ] = args;
    let promises = [];
    const myAgreements = await Agreement.findWithTypeZoneDistrictExemption(db, where, page, limit, orderBy, order);

    // fetch all data that is directly related to the agreement
    // `await` used here to allow the queries to start imediatly and
    // run in parallel. This greatly speeds up the fetch.
    promises = myAgreements.map(async agreement => (
      [
        await agreement.eagerloadAllOneToManyExceptPlan(),
        await agreement.fetchPlans(latestPlan, staffDraft),
      ]
    ));

    await Promise.all(flatten(promises));

    // fetch all data that is indirectly (nested) related to an agreement
    if (sendFullPlan) {
      promises = [];
      myAgreements.forEach((agreement) => {
        promises = [
          ...promises,
          ...agreement.plans.map(async plan =>
            [
              await plan.eagerloadAllOneToMany(),
            ]),
        ];
      });

      await Promise.all(promises);
    }

    return flatten(myAgreements);
  }

  static async findWithTypeZoneDistrictExemption(db, where, page = undefined, limit = undefined, orderBy = 'agreement.forest_file_id', order = 'asc') {
    if (!db || !where) {
      return [];
    }

    const myFields = [
      ...Agreement.fields,
      ...Zone.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...District.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...AgreementType.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...AgreementExemptionStatus.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      let results = [];
      const q = db
        .select(myFields)
        .from(Agreement.table)
        .leftJoin('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
        .leftJoin('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
        .leftJoin('user_account', { 'ref_zone.user_id': 'user_account.id' })
        .leftJoin('plan', (builder) => {
          // eslint-disable-next-line no-shadow
          builder.on('plan.id', '=', (builder) => {
            builder.select('id').from('plan').where('agreement_id', db.ref('agreement.forest_file_id')).limit(1);
          });
        })
        .leftJoin('user_account as plan_creator', { 'plan.creator_id': 'plan_creator.id' })
        .leftJoin('ref_client as agreement_holder', (builder) => {
          // eslint-disable-next-line no-shadow
          builder.onIn('agreement_holder.id', (builder) => {
            builder
              .select('client_id')
              .from('client_agreement')
              .where('agreement_id', db.ref('agreement.forest_file_id'))
              .andWhere('client_type_id', 1)
              .limit(1);
          });
        })
        .leftJoin('ref_plan_status as plan_status', { 'plan.status_id': 'plan_status.id' })
        .leftJoin('ref_agreement_type', { 'agreement.agreement_type_id': 'ref_agreement_type.id' })
        .leftJoin('ref_agreement_exemption_status', { 'agreement.agreement_exemption_status_id': 'ref_agreement_exemption_status.id' })
        .orderBy(orderBy, order);

      if (Object.keys(where).length === 1 && where[Object.keys(where)[0]].constructor === Array) {
        const k = Object.keys(where)[0];
        const v = where[k];
        q.whereIn(k, v);
      } else {
        q.where(where);
      }

      if (page && limit) {
        const offset = limit * (page - 1);
        results = await q
          .offset(offset)
          .limit(limit);
      } else {
        results = await q;
      }

      return results.map(row => new Agreement(row, db));
    } catch (err) {
      throw err;
    }
  }

  static async agreementsForClientId(db, clientId) {
    if (!db || !clientId) {
      return [];
    }

    const results = await db
      .select('agreement_id')
      .from('client_agreement')
      .where({ client_id: clientId });

    return flatten(results.map(result => Object.values(result)));
  }

  static async agreementsForZoneId(db, zoneId) {
    if (!db || !zoneId) {
      return [];
    }

    const results = await db
      .select('forest_file_id')
      .from(Agreement.table)
      .where({ zone_id: zoneId });

    return flatten(results.map(result => Object.values(result)));
  }

  static async searchForTerm(db, term) {
    if (!db || !term) {
      return [];
    }

    try {
      const results = await db
        .select(Agreement.primaryKey)
        .from(Agreement.table)
        .where({ 'agreement.forest_file_id': term })
        .orWhere('agreement.forest_file_id', 'ilike', `%${term}%`);

      // return an array of `forest_file_id`
      return flatten(results.map(result => Object.values(result)));
    } catch (err) {
      throw err;
    }
  }

  static async update(db, where, values) {
    const obj = { };
    Agreement.fields.forEach((field) => {
      const aKey = field.replace(Agreement.table, '').slice(1);
      if (values[Model.toCamelCase(aKey)]) {
        obj[aKey] = values[Model.toCamelCase(aKey)];
      }
    });

    try {
      const results = db
        .table(Agreement.table)
        .where(where)
        .update(obj)
        .returning(this.primaryKey);

      return results;
    } catch (err) {
      throw err;
    }
  }

  async eagerloadAllOneToManyExceptPlan() {
    await this.fetchClients();
    await this.fetchUsage();
    await this.fetchLivestockIdentifiers();
  }

  async fetchClients() {
    const clients = await Client.clientsForAgreement(this.db, this);
    this.clients = clients;
  }

  async fetchPlans(latestPlan = false, staffDraft = false) {
    const order = ['id', 'desc'];
    const where = { agreement_id: this.forestFileId };
    let plans = [];

    // if latestPlan && staffDraft returns the most recent plan except the one whose status is staff draft
    // if latestPlan && !staffDraft returns the most recent plan
    if (latestPlan) {
      const planStatusWhere = staffDraft
        ? { code: PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT }
        : { code: [PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT, PLAN_STATUS.STAFF_DRAFT] };
      const notAllowedStatuses = await PlanStatus.find(this.db, planStatusWhere);
      const whereNot = ['status_id', 'not in', notAllowedStatuses.map(s => s.id)];
      plans = await Plan.findWithStatusExtension(this.db, where, order, 1, 1, whereNot);
    }

    // if !latestPlan && staffDraft returns all the plans
    // if !latestPlan && !staffDraft returns all the plans without the ones whose status are staff draft
    if (!latestPlan) {
      if (staffDraft) {
        plans = await Plan.findWithStatusExtension(this.db, where, order);
      } else {
        const notAllowedStatuses = await PlanStatus.find(this.db, { code: PLAN_STATUS.STAFF_DRAFT });
        const whereNot = ['status_id', 'not in', notAllowedStatuses.map(s => s.id)];
        plans = await Plan.findWithStatusExtension(this.db, where, order, undefined, undefined, whereNot);
      }
    }

    this.plans = plans;
  }

  async fetchUsage() {
    const order = ['year', 'asc'];
    const where = { agreement_id: this.forestFileId };
    const usage = await Usage.find(this.db, where, order);
    this.usage = usage;
  }

  async fetchLivestockIdentifiers() {
    const where = { agreement_id: this.forestFileId };
    const livestockIdentifiers = await LivestockIdentifier.findWithTypeLocation(this.db, where);
    this.livestockIdentifiers = livestockIdentifiers;
  }

  // Transform the client property to match the API v1 specification.
  transformToV1() {
    if (!this.clients && this.clients.length === 0) {
      return;
    }

    Object.defineProperty(this, 'id', {
      enumerable: true,
      value: this.forestFileId,
      writable: false,
    });

    const clients = this.clients.map((client) => {
      const aClient = {
        id: client.id,
        clientNumber: client.clientNumber,
        locationCode: client.locationCode,
        name: client.name,
        clientTypeCode: client.clientType.code,
        startDate: client.licenseeStartDate,
        endDate: client.licenseeEndDate,
      };

      return aClient;
    });

    this.clients = clients.sort((a, b) => a.clientTypeCode > b.clientTypeCode);
  }
}
