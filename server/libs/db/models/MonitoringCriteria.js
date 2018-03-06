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
// Created by Jason Leach on 2018-02-23.

/* eslint-env es6 */

'use strict';

// import { PC_RANGELAND_HEALTH } from '../constants';

export default (sequelize, DataTypes) => {
  const MonitoringCriteria = sequelize.define('monitoringCriteria', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    monitoringSiteId: {
      type: DataTypes.INTEGER,
      field: 'monitoring_site_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      default: new Date(),
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      default: new Date(),
    },
  }, {
    freezeTableName: true,
    tableName: 'monitoring_criteria',
  });

  return MonitoringCriteria;
};
