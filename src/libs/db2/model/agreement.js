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
import AgreementType from './agreementtype';
import Client from './client';
import District from './district';
import LivestockIdentifier from './livestockidentifier';
import Model from './model';
import Plan from './plan';
import PlanStatus from './planstatus';
import Usage from './usage';
import User from './user';
import Zone from './zone';
import { PLAN_EXTENSION_STATUS } from '../../../constants';

export default class Agreement extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Agreement.fields.indexOf(`${Agreement.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });
    super(obj, db);
    this.zone = new Zone(Zone.extract(data), db);
    this.zone.district = new District(District.extract(data), db);
    this.zone.user = new User(User.extract(data), db);
    this.agreementType = new AgreementType(AgreementType.extract(data), db);
    if (data.plan_id) {
      this.plan = new Plan(Plan.extract(data), db);
      this.plan.status = new PlanStatus(PlanStatus.extract(data), db);
    } else {
      this.plan = null;
    }
  }

  // To matche previous Agreement (sequelize) schema.
  get id() {
    return this.forestFileId;
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'forest_file_id',
      'agreement_start_date',
      'agreement_end_date',
      'zone_id',
      'agreement_exemption_status_id',
      'agreement_type_id',
      'retired',
    ].map((f) => `${Agreement.table}.${f}`);
  }

  static get table() {
    return 'agreement';
  }

  static async findWithAllRelations(
    db,
    where,
    page,
    limit,
    latestPlan,
    sendFullPlan,
    staffDraft,
    orderBy,
    order,
    filters,
  ) {
    // Destructuring rest parameters(orders still matter when passing parameters!)
    page = undefined;
    limit = undefined;
    latestPlan = false;
    sendFullPlan = false;
    staffDraft = false;
    orderBy = orderBy || 'agreement.forest_file_id';
    order = order || 'asc';
    let promises = [];
    const myAgreements = await Agreement.findWithTypeZoneDistrictExemption(
      db,
      where,
      page,
      limit,
      orderBy,
      order,
      filters,
    );
    // fetch all data that is directly related to the agreement
    // `await` used here to allow the queries to start imediatly and
    // run in parallel. This greatly speeds up the fetch.
    promises = myAgreements.map(async (agreement) => [
      await agreement.eagerloadAllOneToManyExceptPlan(),
    ]);
    await Promise.all(flatten(promises));

    // fetch all data that is indirectly (nested) related to an agreement
    if (sendFullPlan) {
      myAgreements.forEach(async (agreement) => {
        await agreement.plan?.eagerloadAllOneToMany();
      });
      await Promise.all(promises);
    }

    return flatten(myAgreements);
  }

  static async findWithTypeZoneDistrictExemption(
    db,
    where,
    page = undefined,
    limit = undefined,
    orderBy = 'plan.agreement_id',
    order = 'asc',
    filters,
  ) {
    if (!db || !where) {
      return [];
    }
    const myFields = [
      ...Agreement.fields,
      ...Zone.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...District.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...AgreementType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      // ...AgreementExemptionStatus.fields.map(
      //   (f) => `${f} AS ${f.replace(".", "_")}`,
      // ),
      ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...Plan.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...PlanStatus.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];

    let results = [];
    const q = db
      .select(myFields)
      .from(Agreement.table)
      .leftJoin('plan', {
        'agreement.forest_file_id': 'plan.agreement_id',
      })
      .leftJoin('ref_plan_status', {
        'plan.status_id': 'ref_plan_status.id',
      })
      .leftJoin('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .leftJoin('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
      .leftJoin('user_account', { 'ref_zone.user_id': 'user_account.id' })

      .leftJoin('user_account as plan_creator', {
        'plan.creator_id': 'plan_creator.id',
      })

      .leftJoin('client_agreement', {
        'agreement.forest_file_id': 'client_agreement.agreement_id',
        'client_agreement.client_type_id': 1,
      })
      .leftJoin('ref_client as agreement_holder', {
        'agreement_holder.client_number': 'client_agreement.client_id',
      })
      .leftJoin('ref_agreement_type', {
        'agreement.agreement_type_id': 'ref_agreement_type.id',
      })
      .orderByRaw(
        `${orderBy} ${order === 'asc' ? 'asc nulls last' : 'desc nulls last'}`,
      );
    if (
      Object.keys(where).length === 1 &&
      where[Object.keys(where)[0]].constructor === Array
    ) {
      const k = Object.keys(where)[0];
      const v = where[k];
      q.whereIn(k, v);
    } else {
      q.where(where);
    }
    q.where(function () {
      this.whereNull('plan.extension_status').orWhereNot({
        'plan.extension_status':
          PLAN_EXTENSION_STATUS.INCACTIVE_REPLACEMENT_PLAN,
      });
    });
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).map((filter) => {
        if (filters[filter] && filters[filter] !== '') {
          if (filter === 'user_account.family_name') {
            q.whereRaw(
              `"user_account"."given_name" || ' ' || "user_account"."family_name" ilike '%${filters[filter]}%'`,
            );
          } else if (filter === 'plan.plan_end_date') {
            // Can't get entire string with letters and numbers for some reason
            q.whereRaw(
              `TO_CHAR("plan"."plan_end_date", 'Month DD, YYYY') ilike '%${filters[filter]}%'`,
            );
          } else if (filter === 'plan.status_id') {
            if (filters[filter] && filters[filter].length > 0) {
              const filterArray = filters[filter].split(',');
              q.whereIn('ref_plan_status.code', filterArray);
            }
          } else if (filter === 'planCheck') {
            if (filters[filter] === 'true')
              q.whereNotNull('ref_plan_status.code');
          } else if (filter === 'agreementCheck') {
            if (filters[filter] === 'true')
              q.where('agreement.retired', 'false');
          } else if (filter === 'activeCheck') {
            if (filters[filter] === 'true') {
              q.whereRaw(
                `(
                  "ref_plan_status"."id"=8 OR
                  "ref_plan_status"."id"=9 OR
                  "ref_plan_status"."id"=12 OR
                  "ref_plan_status"."id"=20 OR
                  "ref_plan_status"."id"=21 OR
                  "ref_plan_status"."id"=22 OR
                  (
                    "plan"."amendment_type_id" IS NOT NULL
                    AND (
                      "ref_plan_status"."id"=11 OR
                      "ref_plan_status"."id"=13 OR
                      "ref_plan_status"."id"=18
                    )
                  )
                )`,
              );
            }
          } else if (filter === 'showReplacedPlans') {
            if (filters[filter] !== 'true')
              q.where(function () {
                this.whereNull('plan.extension_status').orWhereNot({
                  'plan.extension_status':
                    PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
                });
              });
          } else {
            q.where(filter, 'ilike', `%${filters[filter]}%`);
          }
        }
      });
    }
    if (page && limit) {
      const offset = limit * (page - 1);
      results = await q.offset(offset).limit(limit);
    } else {
      results = await q;
    }
    // console.debug(q.toSQL().toNative());
    return results.map((row) => new Agreement(row, db));
  }

  static async agreementsForClientId(db, clientId) {
    if (!db || !clientId) {
      return [];
    }

    const results = await db
      .select('agreement_id')
      .from('client_agreement')
      .where({ client_id: clientId });

    return flatten(results.map((result) => Object.values(result)));
  }

  static async agreementsForZoneId(db, zoneId) {
    if (!db || !zoneId) {
      return [];
    }

    const results = await db
      .select('forest_file_id')
      .from(Agreement.table)
      .where({ zone_id: zoneId });

    return flatten(results.map((result) => Object.values(result)));
  }

  static async searchForTerm(db, term) {
    if (!db || !term) {
      return [];
    }

    const results = await db
      .select(Agreement.primaryKey)
      .from(Agreement.table)
      .where({ 'agreement.forest_file_id': term })
      .orWhere('agreement.forest_file_id', 'ilike', `%${term}%`);

    // return an array of `forest_file_id`
    return flatten(results.map((result) => Object.values(result)));
  }

  static async retireAgreements(db, activeFTAAgreementIds) {
    const results = db
      .table(Agreement.table)
      .whereNotIn('forest_file_id', activeFTAAgreementIds)
      .update({ retired: true })
      .returning(this.primaryKey);
    return results;
  }

  async eagerloadAllOneToManyExceptPlan() {
    await this.fetchClients();
    await this.fetchUsage();
    await this.fetchLivestockIdentifiers();
    await this.plan?.fetchExtensionRequests();
  }

  async fetchClients() {
    const clients = await Client.clientsForAgreement(this.db, this);
    this.clients = clients;
  }

  async fetchUsage() {
    const order = ['year', 'asc'];
    const where = { agreement_id: this.forestFileId };
    const usage = await Usage.find(this.db, where, order);
    this.usage = usage;
  }

  async fetchLivestockIdentifiers() {
    const where = { agreement_id: this.forestFileId };
    const livestockIdentifiers = await LivestockIdentifier.findWithTypeLocation(
      this.db,
      where,
    );
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
        id: client.clientNumber,
        locationCodes: client.locationCodes,
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
