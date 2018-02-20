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
// import * as Constants from './constants';

export default class DataManager {
  constructor(config) {
    this.sequelize = new Sequelize(config.get('db:url'), {
      logging: false,
      operatorsAliases: Sequelize.Op,
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
    this.Zone.hasOne(this.Agreement);
    this.District.hasMany(this.Zone, { as: 'Zones', foreignKey: 'district_id' });
    this.Zone.belongsTo(this.District);
  }
}
