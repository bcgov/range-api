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

import { PC_ACTION_TYPE } from '../constants';

export default (sequelize, DataTypes) => {
  const PlantCommunityAction = sequelize.define('plantCommunityAction', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    actionType: {
      field: 'action_type',
      type: DataTypes.TEXT,
      values: Object.keys(PC_ACTION_TYPE).map(k => PC_ACTION_TYPE[k]),
    },
    description: {
      type: DataTypes.TEXT,
    },
    noGrazeStart: {
      field: 'no_graze_start',
      type: DataTypes.DATE,
    },
    noGrazeEnd: {
      field: 'no_graze_end',
      type: DataTypes.DATE,
    },
    plantCommunityId: {
      field: 'plant_community_id',
      type: DataTypes.INTEGER,
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    timestamps: false,
    underscored: true,
    tableName: 'plant_community_action',
  });

  return PlantCommunityAction;
};
