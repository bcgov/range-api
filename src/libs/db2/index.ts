//
// Copyright (c) 2018 Fullboar Creative, Corp. All rights reserved.
//
// This software and documentation is the confidential and proprietary
// information of Fullboar Creative, Corp.
// ("Confidential Information"). You shall not disclose such Confidential
// Information and shall use it only in accordance with the terms of the
// license agreement you entered into with Fullboar Creative, Corp.
//

'use strict';

import { sql } from 'kysely';
import { db as kyselyDb } from './kysely.js';
import config from '../../config/index.js';
import AdditionalRequirement from './model/additionalrequirement.js';
import AdditionalRequirementCategory from './model/additionalrequirementcategory.js';
import Agreement from './model/agreement.js';
import ExemptionStatusType from './model/exemptionstatustype.js';
import AgreementType from './model/agreementtype.js';
import AmendmentType from './model/amendmenttype.js';
import Client from './model/client.js';
import ClientAgreement from './model/ClientAgreement.js';
import ClientType from './model/clienttype.js';
import District from './model/district.js';
import EmailTemplate from './model/emailtemplate.js';
import Exemption from './model/exemption.js';
import AgreementExemptionStatus from './model/agreementexemptionstatus.js';
import ExemptionStatusHistory from './model/exemptionstatushistory.js';
import ExemptionAttachment from './model/exemptionattachment.js';
import Schedule from './model/grazingschedule.js';
import GrazingScheduleEntry from './model/grazingscheduleentry.js';
import HayCuttingScheduleEntry from './model/haycuttingscheduleentry.js';
import IndicatorPlant from './model/indicatorplant.js';
import InvasivePlantChecklist from './model/invasiveplantchecklist.js';
import LivestockIdentifier from './model/livestockidentifier.js';
import LivestockIdentifierLocation from './model/livestockidentifierlocation.js';
import LivestockIdentifierType from './model/livestockidentifiertype.js';
import LivestockType from './model/livestocktype.js';
import ManagementConsideration from './model/managementconsideration.js';
import ManagementConsiderationType from './model/managementconsiderationtype.js';
import MinisterIssue from './model/ministerissue.js';
import MinisterIssueAction from './model/ministerissueaction.js';
import MinisterIssueActionType from './model/ministerissueactiontype.js';
import MinisterIssuePasture from './model/ministerissuepasture.js';
import MinisterIssueType from './model/ministerissuetype.js';
import MonitoringArea from './model/monitoringarea.js';
import MonitoringAreaHealth from './model/monitoringareahealth.js';
import MonitoringAreaPurpose from './model/monitoringareapurpose.js';
import MonitoringAreaPurposeType from './model/monitoringareapurposetype.js';
import Pasture from './model/pasture.js';
import Plan from './model/plan.js';
import PlanConfirmation from './model/planconfirmation.js';
import PlanExtensionRequests from './model/planextensionrequests.js';
import PlanFile from './model/PlanFile.js';
import PlanStatus from './model/planstatus.js';
import PlanStatusHistory from './model/planstatushistory.js';
import PlantCommunity from './model/plantcommunity.js';
import PlantCommunityAction from './model/plantcommunityaction.js';
import PlantCommunityActionType from './model/plantcommunityactiontype.js';
import PlantCommunityElevation from './model/plantcommunityelevation.js';
import PlantCommunityType from './model/plantcommunitytype.js';
import PlantSpecies from './model/plantspecies.js';
import Usage from './model/usage.js';
import User from './model/user.js';
import UserClientLink from './model/userclientlink.js';
import UserDistricts from './model/userDistricts.js';
import UserFeedback from './model/userfeedback.js';
import UserPermissions from './model/userPermissions.js';
import Version from './model/version.js';
import Zone from './model/zone.js';

export default class DataManager {
  [key: string]: any;
  public db: any;
  public config: any;

  constructor() {
    const dbFn = (tableName: string) => {
      const tbl = tableName as any;
      const query: any = {
        insert: (data: any) => kyselyDb.insertInto(tbl).values(data).execute(),
        where: (...args: any[]) => {
          if (args.length === 1) {
            return kyselyDb
              .selectFrom(tbl)
              .where(args[0] as any)
              .selectAll()
              .execute();
          }
          return kyselyDb
            .selectFrom(tbl)
            .where(args[0] as any, '=', args[1])
            .selectAll()
            .execute();
        },
      };
      query.then = (resolve: any, reject?: any) => kyselyDb.selectFrom(tbl).selectAll().execute().then(resolve, reject);
      return query;
    };

    this.db = new Proxy(dbFn, {
      get(target, prop) {
        if (prop === 'schema') {
          return {
            raw: async (str: string) => {
              await sql.raw(str).execute(kyselyDb as any);
            },
          };
        }
        if (prop in target) {
          return (target as any)[prop];
        }
        const value = (kyselyDb as any)[prop];
        if (typeof value === 'function') {
          return value.bind(kyselyDb);
        }
        return value;
      },
    });
    this.config = config;
    this.Agreement = Agreement;
    this.ExemptionStatusType = ExemptionStatusType;
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
    this.Exemption = Exemption;
    this.AgreementExemptionStatus = AgreementExemptionStatus;
    this.ExemptionStatusHistory = ExemptionStatusHistory;
    this.ExemptionAttachment = ExemptionAttachment;
  }
}
