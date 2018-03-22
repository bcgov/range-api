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
  const Zone = sequelize.define('zone', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    code: {
      type: DataTypes.STRING(5),
      allowNull: false,
      validate: {
        is: /^[a-z\d]+$/i,
        len: [3, 5],
      },
    },
    description: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    contactName: {
      field: 'contact_name',
      type: DataTypes.STRING(32),
    },
    contactPhoneNumber: {
      field: 'contact_phone',
      type: DataTypes.STRING(16),
    },
    contactEmail: {
      field: 'contact_email',
      type: DataTypes.STRING(32),
    },
    districtId: {
      type: DataTypes.INTEGER,
      field: 'district_id',
      allowNull: false,
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
    tableName: 'ref_zone',
  });

  return Zone;
};
