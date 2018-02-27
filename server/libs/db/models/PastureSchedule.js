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
// Created by Jason Leach on 2018-02-23.
//

/* eslint-env es6 */

'use strict';

/*
  This is a “Grazing Schedule” for E01 and E02 (grazing) agreements and
  “Hay Cutting Schedule” for H01 and H02 (hay cutting) agreements
  are the best names.
*/

export default (sequelize, DataTypes) => {
  const PastureSchedule = sequelize.define('pastureSchedule', {
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
    description: {
      type: DataTypes.TEXT,
    },
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: 'pasture_schedule',
  });

  return PastureSchedule;
};
