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
import config from '../../config';
import AdditionalRequirement from './model/additionalrequirement';
import AdditionalRequirementCategory from './model/additionalrequirementcategory';
import Agreement from './model/agreement';
import AgreementExemptionStatus from './model/agreementexemptionstatus';
import AgreementType from './model/agreementtype';
import AmendmentType from './model/amendmenttype';
import Client from './model/client';
import ClientAgreement from './model/ClientAgreement';
import ClientType from './model/clienttype';
import District from './model/district';
import EmailTemplate from './model/emailtemplate';
import Schedule from './model/grazingschedule';
import GrazingScheduleEntry from './model/grazingscheduleentry';
import HayCuttingScheduleEntry from './model/haycuttingscheduleentry';
import IndicatorPlant from './model/indicatorplant';
import InvasivePlantChecklist from './model/invasiveplantchecklist';
import LivestockIdentifier from './model/livestockidentifier';
import LivestockIdentifierLocation from './model/livestockidentifierlocation';
import LivestockIdentifierType from './model/livestockidentifiertype';
import LivestockType from './model/livestocktype';
import ManagementConsideration from './model/managementconsideration';
import ManagementConsiderationType from './model/managementconsiderationtype';
import MinisterIssue from './model/ministerissue';
import MinisterIssueAction from './model/ministerissueaction';
import MinisterIssueActionType from './model/ministerissueactiontype';
import MinisterIssuePasture from './model/ministerissuepasture';
import MinisterIssueType from './model/ministerissuetype';
import MonitoringArea from './model/monitoringarea';
import MonitoringAreaHealth from './model/monitoringareahealth';
import MonitoringAreaPurpose from './model/monitoringareapurpose';
import MonitoringAreaPurposeType from './model/monitoringareapurposetype';
import Pasture from './model/pasture';
import Plan from './model/plan';
import PlanConfirmation from './model/planconfirmation';
import PlanExtensionRequests from './model/planextensionrequests';
import PlanFile from './model/PlanFile';
import PlanStatus from './model/planstatus';
import PlanStatusHistory from './model/planstatushistory';
import PlantCommunity from './model/plantcommunity';
import PlantCommunityAction from './model/plantcommunityaction';
import PlantCommunityActionType from './model/plantcommunityactiontype';
import PlantCommunityElevation from './model/plantcommunityelevation';
import PlantCommunityType from './model/plantcommunitytype';
import PlantSpecies from './model/plantspecies';
import PlanVersion from './model/planversion';
import Usage from './model/usage';
import User from './model/user';
import UserClientLink from './model/userclientlink';
import UserDistricts from './model/userDistricts';
import UserFeedback from './model/userfeedback';
import UserPermissions from './model/userPermissions';
import Version from './model/version';
import Zone from './model/zone';

export const connection = knex({
  client: 'pg',
  connection: {
    user: config.get('db:user'),
    database: config.get('db:database'),
    port: config.get('db:port'),
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

export default class DataManager {
  constructor() {
    const k = connection;
    this.db = k;
    this.config = config;
    this.Agreement = Agreement;
    this.AgreementExemptionStatus = AgreementExemptionStatus;
    this.AgreementType = AgreementType;
    this.Client = Client;
    this.ClientType = ClientType;
    this.ClientAgreement = ClientAgreement;
    this.District = District;
    this.UserDistricts = UserDistricts;
    this.Schedule = Schedule;
    this.GrazingScheduleEntry = GrazingScheduleEntry;
    this.HayCuttingScheduleEntry = HayCuttingScheduleEntry;
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
    this.PlanVersion = PlanVersion;
    this.PlanStatus = PlanStatus;
    this.PlanExtensionRequests = PlanExtensionRequests;
    this.Pasture = Pasture;
    this.User = User;
    this.Role = UserPermissions;
    this.Usage = Usage;
    this.Zone = Zone;
    this.AmendmentType = AmendmentType;
    this.PlanStatusHistory = PlanStatusHistory;
    this.PlanConfirmation = PlanConfirmation;
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
    this.AdditionalRequirement = AdditionalRequirement;
    this.AdditionalRequirementCategory = AdditionalRequirementCategory;
    this.ManagementConsideration = ManagementConsideration;
    this.ManagementConsiderationType = ManagementConsiderationType;
    this.UserFeedback = UserFeedback;
    this.Version = Version;
    this.UserClientLink = UserClientLink;
    this.PlanFile = PlanFile;
    this.EmailTemplate = EmailTemplate;
  }
}
