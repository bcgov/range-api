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

import {
  LIVESTOCK_TYPE,
  LIVESTOCK_AUFACTOR,
  AVERAGE_DAYS_PER_MONTH,
} from '../constants';

/*
  This is a “Grazing Schedule” for E01 and E02 (grazing) agreements and
  “Hay Cutting Schedule” for H01 and H02 (hay cutting) agreements
  are the best names.
*/

export default (sequelize, DataTypes) => {
  const PastureScheduleEntry = sequelize.define('pastureScheduleEntry', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    startDate: {
      field: 'start_date',
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      field: 'end_date',
      type: DataTypes.DATE,
      allowNull: false,
    },
    graceDays: {
      field: 'grace_days',
      type: DataTypes.INTEGER,
    },
    livestockCount: {
      field: 'livestock_count',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    livestockType: {
      field: 'livestock_type',
      type: DataTypes.TEXT,
      values: Object.keys(LIVESTOCK_TYPE).map(k => LIVESTOCK_TYPE[k]),
      allowNull: false,
    },
    pastureScheduleId: {
      field: 'pasture_schedule_id',
      type: DataTypes.INTEGER,
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
    tableName: 'pasture_schedule_entry',
  });


  //
  // Instance Method
  //

  /* eslint-disable func-names */

  PastureScheduleEntry.prototype.totalDays = function () {
    return Math.round((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  };

  // Private Land Deduction (AMU)
  PastureScheduleEntry.prototype.pdlAum = function (pldPercent) {
    return Math.round(this.crownAum() * pldPercent * 100) / 100;
  };

  // AUMs = (Number of Animals * Days * Animal Class Proportion) / Days per month
  PastureScheduleEntry.prototype.crownAum = function () {
    const aufactor = LIVESTOCK_AUFACTOR[this.livestockType];
    const aum = (this.livestockCount * this.totalDays() * aufactor) / AVERAGE_DAYS_PER_MONTH;
    return Math.round(aum * 100) / 100;
  };

  // Because livestock only graze during months when vegetation is growing
  // the start date and end date will always be within the same calendar year.
  PastureScheduleEntry.prototype.year = function () {
    return this.endDate.getFullYear();
  };

  /* eslint-enable func-names */

  return PastureScheduleEntry;
};
