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

import { SSO_ROLE_MAP } from '../../../constants';

export default (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    username: {
      allowNull: false,
      type: DataTypes.STRING(16),
      unique: true,
    },
    givenName: {
      field: 'given_name',
      type: DataTypes.STRING(32),
    },
    familyName: {
      field: 'family_name',
      type: DataTypes.STRING(32),
    },
    email: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING(32),
    },
    roleId: {
      field: 'role_id',
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    timestamps: false,
    underscored: true,
    tableName: 'user_account',
  });

  //
  // Instance Method
  //

  /* eslint-disable func-names, arrow-body-style */

  User.prototype.isAdministrator = function () {
    return this.roles && this.roles.includes(SSO_ROLE_MAP.ADMINISTRATOR);
  };

  return User;
};

