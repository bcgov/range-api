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
      type: DataTypes.TEXT,
    },
    description: {
      type: DataTypes.TEXT,
    },
    // districtId: {
    //   type: DataTypes.INTEGER,
    //   field: 'district_id',
    // },
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
    timestamps: false,
    underscored: true,
  });

  return Zone;
};
