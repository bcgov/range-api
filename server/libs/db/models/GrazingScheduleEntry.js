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

// import {
//   AVERAGE_DAYS_PER_MONTH,
// } from '../constants';

/*
  This is a “Grazing Schedule” for E01 and E02 (grazing) agreements and
  “Hay Cutting Schedule” for H01 and H02 (hay cutting) agreements
  are the best names.
*/

export default (sequelize, DataTypes) => {
  const GrazingScheduleEntry = sequelize.define('grazingScheduleEntry', {
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
    dateIn: {
      type: DataTypes.DATE,
      field: 'date_in',
      allowNull: false,
    },
    dateOut: {
      type: DataTypes.DATE,
      field: 'date_out',
      allowNull: false,
    },
    livestockTypeId: {
      field: 'livestock_type_id',
      type: DataTypes.INTEGER,
    },
    grazingScheduleId: {
      field: 'grazing_schedule_id',
      type: DataTypes.INTEGER,
    },
    pastureId: {
      field: 'pasture_id',
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
    freezeTableName: true,
    timestamps: false,
    underscored: true,
    tableName: 'grazing_schedule_entry',
  });


  //
  // Instance Method
  //

  /* eslint-disable func-names */

  GrazingScheduleEntry.prototype.totalDays = function () {
    return Math.round((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  };

  // // Private Land Deduction (AMU)
  // GrazingScheduleEntry.prototype.pdlAum = function (pldPercent) {
  //   return Math.round(this.crownAum() * pldPercent * 100) / 100;
  // };

  // // AUMs = (Number of Animals * Days * Animal Class Proportion) / Days per month
  // GrazingScheduleEntry.prototype.crownAum = function () {
  //   const aufactor = LIVESTOCK_AUFACTOR[this.livestockType];
  //   const aum = (this.livestockCount * this.totalDays() * aufactor) / AVERAGE_DAYS_PER_MONTH;
  //   return Math.round(aum * 100) / 100;
  // };

  // Because livestock only graze during months when vegetation is growing
  // the start date and end date will always be within the same calendar year.
  GrazingScheduleEntry.prototype.year = function () {
    return this.endDate.getFullYear();
  };

  /* eslint-enable func-names */

  return GrazingScheduleEntry;
};
