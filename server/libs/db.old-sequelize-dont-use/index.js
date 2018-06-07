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

// import fs from 'fs';
// import path from 'path';
// import Sequelize from 'sequelize';

// export default class DataManager {
//   constructor(config) {
//     this.sequelize = new Sequelize(config.get('db:database'),
//       config.get('db:user'), config.get('db:password'), {
//       host: config.get('db:host'),
//       dialect: 'postgres',
//       logging: false,
//       underscored: true,
//       operatorsAliases: Sequelize.Op,
//       pool: {
//         max: 3,
//         min: 0,
//         acquire: 30000,
//         idle: 10000,
//       },
//     });

//     this.config = config;
//     this.loadModels();
//     this.buildRelations();
//     this.setupIncludeAttributes();
//     this.setupHelperFunctions();
//   }

//   setupHelperFunctions() {
//     /**
//      * Transform a client object to the format apropriate for the API spec
//      *
//      * @param {[Client]} clients The agreement object containing the clients
//      * @param {[ClientType]} clientTypes The client type reference objects
//      * @returns Array of plain (JSON) client objects
//      */
//     this.transformClients = (clients, clientTypes) => {
//       const results = clients
//         .map((c) => {
//           const client = c.get({ plain: true });
//           const ctype = clientTypes.find(t => t.id === c.clientAgreement.clientTypeId);
//           delete client.clientAgreement;
//           return { ...client, clientTypeCode: ctype.code };
//         })
//         .sort((a, b) => a.clientTypeCode > b.clientTypeCode);

//       return results;
//     };

//     /**
//      * Transform the structure of an Agreement to match the API spec
//      *
//      * @param {Agreement} agreement The agreement object containing the clients
//      * @param {[ClientType]} clientTypes The client type reference objects
//      * @returns A plain (JSON) Agreement object
//      */
//     this.transformAgreement = (agreement, clientTypes) => {
//       const transformedClients = this.transformClients(agreement.clients, clientTypes);
//       const agreementAsJSON = agreement.get({ plain: true });
//       agreementAsJSON.clients = transformedClients;

//       return agreementAsJSON;
//     };
//   }

//   loadModels() {
//     fs.readdirSync(path.join(__dirname, 'models'))
//       .filter(file => (file.indexOf('.') !== 0) && (file !== 'index.js'))
//       .forEach((file) => {
//         const model = this.sequelize.import(path.join(__dirname, 'models', file));
//         const name = model.name.charAt(0).toUpperCase() + model.name.slice(1);
//         this[name] = model;

//         if (this[name].associate) {
//           this[name].associate(this);
//         }
//       });
//   }

//   buildRelations() {
//     //
//     // Client Type
//     //
//     this.ClientAgreement.belongsTo(this.ClientType);

//     //
//     // User Role
//     //
//     // this.User.belongsTo(this.UserRole, { foreignKey: 'role_id' });

//     //
//     // Client, Agreement
//     //

//     // A Client can have multiple Agreements, and an Agreement can have multiple clients.
//     this.Agreement.belongsToMany(this.Client, { through: { model: this.ClientAgreement } });
//     this.Client.belongsToMany(this.Agreement, { through: { model: this.ClientAgreement } });

//     //
//     // Agreement Type, Agreement Status
//     //

//     this.Agreement.belongsTo(this.AgreementType);
//     this.Agreement.belongsTo(this.AgreementExemptionStatus); // { as: 'exemptionStatus' }

//     // One District per Zone. This relation allows us to easily query for
//     // at Zone's District.
//     this.Zone.belongsTo(this.District);
//     this.Zone.belongsTo(this.User);

//     // A zone can bridge one or more Agreements. This relation allows us to easily
//     // query for the Applications in particular zone.
//     // this.Zone.belongsToMany(this.Agreement, { through: 'agreement_zone' });
//     // One Zone per Agreement. This relation allows us to easlily query for
//     // an Agreement's Zone.
//     this.Agreement.belongsTo(this.Zone); // { foreignKey: { allowNull: false } }

//     //
//     // Agreements and Livestock Identifiers
//     //

//     // this.LivestockIdentifier.belongsTo(this.Agreement);
//     this.LivestockIdentifier.belongsTo(this.LivestockIdentifierType);
//     this.LivestockIdentifier.belongsTo(this.LivestockIdentifierLocation);
//     this.Agreement.hasMany(this.LivestockIdentifier);

//     //
//     // Agreements and Range Usage
//     //

//     this.Agreement.hasMany(this.Usage, { as: 'usage' });

//     //
//     // Agreement and Plan
//     //

//     this.Agreement.hasMany(this.Plan);
//     this.Plan.belongsTo(this.PlanStatus, { as: 'status' });

//     //
//     // Agreements and Extension
//     //

//     // this.Agreement.belongsTo(this.Extension);

//     //
//     // Agreements and Grazing Schedule
//     //

//     this.Plan.hasMany(this.GrazingSchedule);

//     //
//     // GrazingScheduleEntry, Grazing Schedule, LivestockType
//     //

//     this.GrazingSchedule.hasMany(this.GrazingScheduleEntry);
//     this.GrazingScheduleEntry.belongsTo(this.LivestockType);
//     this.GrazingScheduleEntry.belongsTo(this.Pasture);

//     //
//     // Agreements and Pasture, Plant Communities, Monitoring Sites,
//     // and Criteria.
//     //

//     this.Plan.hasMany(this.Pasture);

//     // // Spatially a pasture could be large and occur in multiple RUPs (either adjacent
//     // // or over the same area). However, from a data perspective, they are specific to
//     // // a single RUP.

//     this.Pasture.hasMany(this.PlantCommunity);
//     this.PlantCommunity.hasMany(this.PlantCommunityAction, { as: 'actions' });
//     this.PlantCommunity.belongsTo(this.PlantCommunityAspect, { as: 'aspect' }); // x
//     this.PlantCommunity.belongsTo(this.PlantCommunityElevation, { as: 'elevation' }); // x
//     this.PlantCommunityAction.belongsTo(this.PlantCommunityActionPurpose,
//     { as: 'actionPurpose' });
//     this.PlantCommunityAction.belongsTo(this.PlantCommunityActionType, { as: 'actionType' });

//     // this.PlantCommunity.hasMany(this.MonitoringSite);
//     // this.MonitoringSite.hasMany(this.MonitoringCriteria);


//     // //
//     // // Agreements and Plant Action.
//     // //
//     // this.PlantActionReference.belongsToMany(this.Agreement,
//     // { through: 'agreement_plant_action' });
//   }

//   setupIncludeAttributes() {
//     this.INCLUDE_AGREEMENT_TYPE_MODEL = {
//       model: this.AgreementType,
//     };

//     this.INCLUDE_DISTRICT_MODEL = {
//       model: this.District,
//       attributes: {
//         exclude: ['createdAt', 'updatedAt'],
//       },
//     };

//     /**
//      * Add `Zone` filtering by userId accounting for Administrative privledges.
//      *
//      * @param {Zone} model The model to be operated on.
//      * @param {User} user The user to filter on.
//      * @returns The `Zone` with the apropriate filtering via the where clause.
//      */
//     this.INCLUDE_ZONE_MODEL = (user) => {
//       const BASIC_INCLUDE_ZONE_MODEL = {
//         model: this.Zone,
//         include: [this.INCLUDE_DISTRICT_MODEL, this.INCLUDE_USER_MODEL],
//         attributes: {
//           exclude: ['districtId', 'createdAt', 'updatedAt', 'user_id', 'district_id'],
//         },
//       };

//       if (user && user.isRangeOfficer() && !user.isAgreementHolder()) {
//         return { ...BASIC_INCLUDE_ZONE_MODEL, where: { userId: user.id } };
//       }

//       return BASIC_INCLUDE_ZONE_MODEL;
//     };

//     this.INCLUDE_CLIENT_MODEL = (user) => {
//       const BASIC_INCLUDE_CLIENT_MODEL = {
//         model: this.Client,
//         through: {
//           model: this.ClientAgreement,
//           attributes: ['clientTypeId'],
//         },
//         attributes: ['id', 'name', 'locationCode', 'startDate'],
//       };

//       if (user && user.isAgreementHolder()) {
//         return { ...BASIC_INCLUDE_CLIENT_MODEL, where: { id: user.clientId } };
//       }

//       return BASIC_INCLUDE_CLIENT_MODEL;
//     };

//     this.INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL = {
//       model: this.AgreementExemptionStatus,
//       attributes: {
//         exclude: ['active', 'createdAt', 'updatedAt'],
//       },
//     };

//     this.INCLUDE_LIVESTOCK_IDENTIFIER_MODEL = {
//       model: this.LivestockIdentifier,
//       include: [this.LivestockIdentifierLocation, this.LivestockIdentifierType],
//       attributes: {
//         exclude: ['livestock_identifier_type_id', 'livestock_identifier_location_id'],
//       },
//     };

//     this.INCLUDE_PLAN_STATUS_MODEL = {
//       model: this.PlanStatus,
//       as: 'status',
//     };

//     this.INCLUDE_PASTURE_MODEL = {
//       model: this.Pasture,
//       attributes: {
//         exclude: ['plan_id'],
//       },
//     };

//     this.INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL = {
//       model: this.GrazingScheduleEntry,
//       include: [this.LivestockType, this.Pasture],
//       attributes: {
//         exclude: ['grazing_schedule_id', 'livestock_type_id'],
//       },
//     };

//     this.INCLUDE_GRAZING_SCHEDULE_MODEL = {
//       model: this.GrazingSchedule,
//       include: [this.INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL],
//     };

//     this.INCLUDE_USER_MODEL = {
//       model: this.User,
//     };

//     this.INCLUDE_PLAN_MODEL = {
//       model: this.Plan,
//       attributes: {
//         exclude: ['status_id', 'agreement_id'],
//       },
//       order: [
//         ['created_at', 'DESC'],
//         ['grazingSchedules', 'year', 'ASC'],
//       ],
//       include: [
//         this.INCLUDE_PLAN_STATUS_MODEL,
//         this.INCLUDE_PASTURE_MODEL,
//         this.INCLUDE_GRAZING_SCHEDULE_MODEL,
//       ],
//     };

//     this.INCLUDE_USAGE_MODEL = {
//       model: this.Usage,
//       as: 'usage',
//       attributes: {
//         exclude: ['agreement_id', 'agreementId', 'createdAt', 'updatedAt'],
//       },
//     };

//     this.STANDARD_INCLUDE_NO_ZONE = [
//       this.INCLUDE_CLIENT_MODEL,
//       this.INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
//       this.INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
//       this.INCLUDE_PLAN_MODEL,
//       this.INCLUDE_USAGE_MODEL,
//       this.INCLUDE_AGREEMENT_TYPE_MODEL,
//     ];

//     this.STANDARD_INCLUDE_NO_ZONE_CLIENT = [
//       this.INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
//       this.INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
//       this.INCLUDE_PLAN_MODEL,
//       this.INCLUDE_USAGE_MODEL,
//       this.INCLUDE_AGREEMENT_TYPE_MODEL,
//     ];

//     this.EXCLUDED_AGREEMENT_ATTR = [
//       'agreementTypeId',
//       'zoneId',
//       'agreementExemptionStatusId',
//     ];
//   }
// }
