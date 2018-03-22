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
// Created by Jason Leach on 2018-03-21.
//

/* eslint-env es6 */

'use strict';

export default (sequelize, DataTypes) => {
  const Plan = sequelize.define('plan', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    rangeName: {
      field: 'range_name',
      type: DataTypes.STRING(32),
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
    agreementId: {
      type: DataTypes.STRING(9),
      field: 'agreement_id',
      allowNull: false,
    },
    extensionId: {
      field: 'extension_id',
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

  return Plan;
};
