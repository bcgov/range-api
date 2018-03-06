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
  LIVESTOCK_ID_TYPE,
  LIVESTOCK_ID_LOCATION,
} from '../constants';

export default (sequelize, DataTypes) => {
  const LivestockIdentifier = sequelize.define('livestockIdentifier', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    type: {
      type: DataTypes.TEXT,
      allowNull: false,
      values: Object.keys(LIVESTOCK_ID_TYPE).map(k => LIVESTOCK_ID_TYPE[k]),
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: false,
      values: Object.keys(LIVESTOCK_ID_LOCATION).map(k => LIVESTOCK_ID_LOCATION[k]),
    },
    imageRef: {
      field: 'image_ref',
      type: DataTypes.TEXT,
    },
    description: {
      type: DataTypes.TEXT,
    },
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: 'livestock_identifier',
  });

  return LivestockIdentifier;
};
