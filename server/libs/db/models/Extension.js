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
  const Extension = sequelize.define('extension', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    requestDate: {
      type: DataTypes.DATE,
      field: 'request_date',
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      field: 'end_date',
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    underscored: true,
    freezeTableName: true,
  });

  return Extension;
};
