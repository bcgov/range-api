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
// Created by Jason Leach on 2018-02-21.
//

/* eslint-env es6 */

'use strict';

export default (sequelize, DataTypes) => {
  const Usage = sequelize.define('usage', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    year: {
      type: DataTypes.TEXT,
      is: /^([0-9]){4}$/i,
      allowNull: false,
    },
    authorizedAmu: {
      type: DataTypes.INTEGER,
      field: 'authorized_amu',
      allowNull: false,
    },
    temporaryIncrease: {
      type: DataTypes.INTEGER,
      field: 'temporary_increase',
    },
    billableNonUse: {
      type: DataTypes.INTEGER,
      field: 'billable_non_use',
    },
    nonBillableNonUse: {
      type: DataTypes.INTEGER,
      field: 'non_billable_non_use',
    },
    totalAnnualUse: {
      type: DataTypes.INTEGER,
      field: 'total_annual_use',
    },
  }, {
    underscored: true,
    freezeTableName: true,
  });

  return Usage;
};
