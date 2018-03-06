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

import {
  AGREEMENT_TYPE,
  EXEMPTION_STATUS,
  RUP_STATUS,
} from '../constants';

export default (sequelize, DataTypes) => {
  const Agreement = sequelize.define('agreement', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    ran: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.TEXT,
      allowNull: false,
      values: Object.keys(AGREEMENT_TYPE).map(k => AGREEMENT_TYPE[k]),
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    forestFileId: {
      field: 'forest_file_id',
      type: DataTypes.TEXT,
    },
    agreementStartDate: {
      field: 'agreement_start_date',
      type: DataTypes.DATE,
    },
    agreementEndDate: {
      field: 'agreement_end_date',
      type: DataTypes.DATE,
    },
    planStartDate: {
      field: 'plan_start_date',
      type: DataTypes.DATE,
    },
    planEndDate: {
      field: 'plan_end_date',
      type: DataTypes.DATE,
    },
    nonUseBillable: {
      field: 'non_use_billable',
      type: DataTypes.BOOLEAN,
    },
    primaryHolder: {
      field: 'price_holder',
      type: DataTypes.TEXT,
    },
    tempHolder: {
      field: 'temp_holder',
      type: DataTypes.TEXT,
    },
    exemptionStatus: {
      field: 'exemption_status',
      type: DataTypes.TEXT,
      values: Object.keys(EXEMPTION_STATUS).map(k => EXEMPTION_STATUS[k]),
    },
    status: {
      type: DataTypes.TEXT,
      values: Object.keys(RUP_STATUS).map(k => RUP_STATUS[k]),
    },
    notes: {
      type: DataTypes.TEXT,
    },
    zoneId: {
      type: DataTypes.INTEGER,
      field: 'zone_id',
    },
    extensionId: {
      type: DataTypes.INTEGER,
      field: 'extension_id',
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
  });

  // // Instance Method
  // Agreement.prototype.isExtendable = function () {
  //   return typeof this.extension === 'undefined';
  // };

  return Agreement;
};

