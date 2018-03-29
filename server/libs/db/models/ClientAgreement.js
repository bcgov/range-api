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
// Created by Jason Leach on 2018-03-28.
//

/* eslint-env es6 */

'use strict';

export default (sequelize, DataTypes) => {
  const ClientType = sequelize.define('clientAgreement', {
    agreementId: {
      type: DataTypes.STRING(9),
      allowNull: false,
      field: 'agreement_id',
    },
    clientId: {
      type: DataTypes.STRING(8),
      allowNull: false,
      field: 'client_id',
    },
    clientTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'client_type_id',
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
    tableName: 'client_agreement',
  });

  return ClientType;
};
