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
// Created by Jason Leach on 2018-02-22.

/* eslint-env es6 */

'use strict';

import {
  ASPECT,
  ELEVATION,
  PC_ACTION_PURPOSE,
} from '../constants';

export default (sequelize, DataTypes) => {
  const PlantCommunity = sequelize.define('plantCommunity', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    aspect: {
      type: DataTypes.TEXT,
      values: Object.keys(ASPECT).map(k => ASPECT[k]),
    },
    elevation: {
      type: DataTypes.TEXT,
      values: Object.keys(ELEVATION).map(k => ELEVATION[k]),
    },
    actionPurpose: {
      type: DataTypes.TEXT,
      values: Object.keys(PC_ACTION_PURPOSE).map(k => PC_ACTION_PURPOSE[k]),
    },
    url: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    // pastureId: {
    //   type: DataTypes.INTEGER,
    //   field: 'pasture_id',
    // },
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
    timestamps: false,
    underscored: true,
    tableName: 'plant_community',
  });

  return PlantCommunity;
};
