//
// Copyright (c) 2018 Fullboar Creative, Corp. All rights reserved.
//
// This software and documentation is the confidential and proprietary
// information of Fullboar Creative, Corp.
// ("Confidential Information"). You shall not disclose such Confidential
// Information and shall use it only in accordance with the terms of the
// license agreement you entered into with Fullboar Creative, Corp.
//

/* eslint-env es6 */

'use strict';

import knex from 'knex';
import Agreement from './model/agreement';
import AgreementExemptionStatus from './model/agreementexemptionstatus';
import AgreementType from './model/agreementtype';
import Client from './model/client';
import ClientType from './model/clienttype';
import District from './model/district';
import GrazingSchedule from './model/grazingschedule';
import LivestockType from './model/livestocktype';
import Pasture from './model/pasture';
import Plan from './model/plan';
import PlanExtension from './model/planextension';
import PlanStatus from './model/planstatus';
import Usage from './model/usage';
import User from './model/user';
import Zone from './model/zone';

export default class DataManager {
  constructor(config) {
    const k = knex({
      client: 'pg',
      connection: {
        user: config.get('db:user'),
        database: config.get('db:database'),
        port: 5432,
        host: config.get('db:host'),
        password: config.get('db:password'),
      },
      searchPath: ['public'],
      debug: false,
      pool: {
        min: 1,
        max: 2,
      },
    });

    this.db = k;
    this.config = config;
    this.Agreement = Agreement;
    this.Zone = Zone;
    this.District = District;
    this.AgreementType = AgreementType;
    this.User = User;
    this.Client = Client;
    this.ClientType = ClientType;
    this.Usage = Usage;
    this.Plan = Plan;
    this.PlanStatus = PlanStatus;
    this.PlanExtension = PlanExtension;
    this.GrazingSchedule = GrazingSchedule;
    this.LivestockType = LivestockType;
    this.Pasture = Pasture;
    this.AgreementExemptionStatus = AgreementExemptionStatus;
  }
}
