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

export default (sequelize, DataTypes) => {
  const Pasture = sequelize.define('pasture', {
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
    allowableAmu: {
      field: 'allowable_amu',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    graceDays: {
      field: 'grace_days',
      type: DataTypes.INTEGER,
      allowNull: false,
      default: 0,
    },
    pdlPercent: {
      field: 'pdl_percent',
      type: DataTypes.FLOAT,
      allowNull: false,
      default: 0,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    underscored: true,
    freezeTableName: true,
  });

  return Pasture;
};
