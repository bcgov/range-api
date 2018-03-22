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

import { EXEMPTION_STATUS } from '../constants';

export default (sequelize, DataTypes) => {
  const Agreement = sequelize.define('agreement', {
    agreementId: {
      field: 'forest_file_id',
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING(9),
      validate: {
        is: /^RAN\d{6}$/i,
        len: [9],
      },
    },
    rangeName: {
      field: 'range_name',
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    alternateBusinessName: {
      field: 'alternate_business_name',
      type: DataTypes.STRING(64),
      validate: {
        len: [0, 64],
      },
    },
    agreementStartDate: {
      field: 'agreement_start_date',
      type: DataTypes.DATE,
      allowNull: false,
    },
    agreementEndDate: {
      field: 'agreement_end_date',
      type: DataTypes.DATE,
      allowNull: false,
    },
    planStartDate: {
      field: 'plan_start_date',
      type: DataTypes.DATE,
    },
    planEndDate: {
      field: 'plan_end_date',
      type: DataTypes.DATE,
    },
    exemptionStatus: {
      field: 'exemption_status',
      type: DataTypes.TEXT,
      values: Object.keys(EXEMPTION_STATUS).map(k => EXEMPTION_STATUS[k]),
    },
    // status: {
    //   type: DataTypes.STRING(1),
    //   validate: {
    //     is: /^[a-z]$/i,
    //     len: [1],
    //   },
    // },
    notes: {
      type: DataTypes.TEXT,
    },
    // zoneId: {
    //   type: DataTypes.INTEGER,
    //   field: 'zone_id',
    //   allowNull: false,
    // },
    // extensionId: {
    //   type: DataTypes.INTEGER,
    //   field: 'extension_id',
    //   allowNull: false,
    // },
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
    timestamps: false,
    freezeTableName: true,
    underscored: true,
  });

  // Agreement.associate = (models) => {
  //   // associations can be defined here
  // };

  // // Instance Method
  // Agreement.prototype.isExtendable = function () {
  //   return typeof this.extension === 'undefined';
  // };

  return Agreement;
};
