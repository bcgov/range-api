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
import GrazingScheduleEntry from './model/grazingscheduleentry';
import LivestockIdentifier from './model/livestockidentifier';
import LivestockIdentifierLocation from './model/livestockidentifierlocation';
import LivestockIdentifierType from './model/livestockidentifiertype';
import LivestockType from './model/livestocktype';
import Pasture from './model/pasture';
import Plan from './model/plan';
import PlanExtension from './model/planextension';
import PlanStatus from './model/planstatus';
import Usage from './model/usage';
import User from './model/user';
import Zone from './model/zone';
import MinisterIssue from './model/ministerissue';
import MinisterIssueAction from './model/ministerissueaction';
import MinisterIssueActionType from './model/ministerissueactiontype';
import MinisterIssueType from './model/ministerissuetype';
import MinisterIssuePasture from './model/ministerissuepasture';
import AmendmentType from './model/amendmenttype';
import PlanStatusHistory from './model/planstatushistory';
import AmendmentConfirmation from './model/amendmentconfirmation';
import PlantCommunity from './model/plantcommunity';
import PlantCommunityType from './model/plantcommunitytype';
import PlantCommunityAction from './model/plantcommunityaction';
import PlantCommunityActionType from './model/plantcommunityactiontype';
import PlantCommunityElevation from './model/plantcommunityelevation';
import PlantSpecies from './model/plantspecies';
import MonitoringArea from './model/monitoringarea';
import MonitoringAreaHealth from './model/monitoringareahealth';
import MonitoringAreaPurpose from './model/monitoringareapurpose';
import MonitoringAreaPurposeType from './model/monitoringareapurposetype';
import IndicatorPlant from './model/indicatorplant';
import InvasivePlantChecklist from './model/invasiveplantchecklist';

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
        max: 64,
      },
      migrations: {
        tableName: 'migration',
      },
    });

    this.db = k;
    this.config = config;
    this.Agreement = Agreement;
    this.AgreementExemptionStatus = AgreementExemptionStatus;
    this.AgreementType = AgreementType;
    this.Client = Client;
    this.ClientType = ClientType;
    this.District = District;
    this.GrazingSchedule = GrazingSchedule;
    this.GrazingScheduleEntry = GrazingScheduleEntry;
    this.LivestockIdentifier = LivestockIdentifier;
    this.LivestockIdentifierLocation = LivestockIdentifierLocation;
    this.LivestockIdentifierType = LivestockIdentifierType;
    this.LivestockType = LivestockType;
    this.MinisterIssue = MinisterIssue;
    this.MinisterIssueAction = MinisterIssueAction;
    this.MinisterIssueActionType = MinisterIssueActionType;
    this.MinisterIssueType = MinisterIssueType;
    this.MinisterIssuePasture = MinisterIssuePasture;
    this.Plan = Plan;
    this.PlanStatus = PlanStatus;
    this.PlanExtension = PlanExtension;
    this.Pasture = Pasture;
    this.User = User;
    this.Usage = Usage;
    this.Zone = Zone;
    this.AmendmentType = AmendmentType;
    this.PlanStatusHistory = PlanStatusHistory;
    this.AmendmentConfirmation = AmendmentConfirmation;
    this.IndicatorPlant = IndicatorPlant;
    this.PlantSpecies = PlantSpecies;
    this.PlantCommunity = PlantCommunity;
    this.PlantCommunityType = PlantCommunityType;
    this.PlantCommunityAction = PlantCommunityAction;
    this.PlantCommunityActionType = PlantCommunityActionType;
    this.PlantCommunityElevation = PlantCommunityElevation;
    this.MonitoringArea = MonitoringArea;
    this.MonitoringAreaHealth = MonitoringAreaHealth;
    this.MonitoringAreaPurpose = MonitoringAreaPurpose;
    this.MonitoringAreaPurposeType = MonitoringAreaPurposeType;
    this.InvasivePlantChecklist = InvasivePlantChecklist;
  }
}
