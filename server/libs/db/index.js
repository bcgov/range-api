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

import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';

export default class DataManager {
  constructor(config) {
    this.sequelize = new Sequelize(config.get('db:url'), {
      logging: false,
      operatorsAliases: Sequelize.Op,
      underscored: true,
    });
    // this.Constants = Constants;
    this.config = config;
    this.loadModels();
    this.buildRelations();
  }

  loadModels() {
    fs.readdirSync(path.join(__dirname, 'models'))
      .filter(file => (file.indexOf('.') !== 0) && (file !== 'index.js'))
      .forEach((file) => {
        const model = this.sequelize.import(path.join(__dirname, 'models', file));
        const name = model.name.charAt(0).toUpperCase() + model.name.slice(1);
        this[name] = model;

        if (this[name].associate) {
          this[name].associate(this);
        }
      });
  }

  buildRelations() {
    //
    // Client Type
    //
    this.Client.belongsTo(this.ClientType);

    //
    // Client, Agreement
    //

    // A Client can have multiple Agreements.
    this.Agreement.belongsTo(this.Client, { as: 'primaryAgreementHolder', foreignKey: 'primary_agreement_holder_id' });
    // this.Client.belongsToMany(this.Agreement, { as: 'secondaryClient',
    // through: 'client_agreement' });

    //
    // Agreement Type, Agreement Status
    //

    this.Agreement.belongsTo(this.AgreementType);
    this.Agreement.belongsTo(this.AgreementStatus, { as: 'status' });
    this.Agreement.belongsTo(this.ExemptionStatus);

    // A District has multiple zones. This relation allows us to easily
    // query for the Zones in a particular District.
    this.District.belongsToMany(this.Zone, { through: 'district_zone' });
    // One District per Zone. This relation allows us to easily query for
    // at Zone's District.
    this.Zone.belongsTo(this.District);

    // A zone can bridge one or more Agreements. This relation allows us to easily
    // query for the Applications in particular zone.
    // this.Zone.belongsToMany(this.Agreement, { through: 'agreement_zone' });
    // One Zone per Agreement. This relation allows us to easlily query for
    // an Agreement's Zone.
    this.Agreement.belongsTo(this.Zone); // { foreignKey: { allowNull: false } }

    //
    // Agreements and Livestock Identifiers
    //

    // this.LivestockIdentifier.belongsTo(this.Agreement);
    this.LivestockIdentifier.belongsTo(this.LivestockIdentifierType);
    this.LivestockIdentifier.belongsTo(this.LivestockIdentifierLocation);
    this.Agreement.hasMany(this.LivestockIdentifier);

    //
    // Agreements and Range Usage
    //

    this.Agreement.hasMany(this.Usage, { as: 'usage' });

    //
    // Agreements and Extension
    //

    // this.Agreement.belongsTo(this.Extension);

    //
    // Agreements and Grazing Schedule
    //

    this.Agreement.belongsToMany(this.GrazingSchedule, { through: 'agreement_grazing_schedule' });

    //
    // GrazingScheduleEntry, Grazing Schedule, LivestockType
    //

    this.GrazingSchedule.hasMany(this.GrazingScheduleEntry);
    this.GrazingScheduleEntry.belongsTo(this.LivestockType);
    this.GrazingScheduleEntry.belongsTo(this.Pasture);

    //
    // Agreements and Pasture, Plant Communities, Monitoring Sites,
    // and Criteria.
    //

    this.Agreement.hasMany(this.Pasture);

    // // Spatially a pasture could be large and occur in multiple RUPs (either adjacent
    // // or over the same area). However, from a data perspective, they are specific to
    // // a single RUP.

    this.Pasture.hasMany(this.PlantCommunity);
    this.PlantCommunity.hasMany(this.PlantCommunityAction, { as: 'actions' });
    this.PlantCommunity.belongsTo(this.PlantCommunityAspect, { as: 'aspect' }); // x
    this.PlantCommunity.belongsTo(this.PlantCommunityElevation, { as: 'elevation' }); // x
    this.PlantCommunityAction.belongsTo(this.PlantCommunityActionPurpose, { as: 'actionPurpose' });
    this.PlantCommunityAction.belongsTo(this.PlantCommunityActionType, { as: 'actionType' });

    // this.PlantCommunity.hasMany(this.MonitoringSite);
    // this.MonitoringSite.hasMany(this.MonitoringCriteria);


    // //
    // // Agreements and Plant Action.
    // //
    // this.PlantActionReference.belongsToMany(this.Agreement,
    // { through: 'agreement_plant_action' });
  }
}
