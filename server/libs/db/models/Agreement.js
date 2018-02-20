//
// Copyright (c) 2016 Fullboar Creative, Corp. All rights reserved.
//
// This software and documentation is the confidential and proprietary
// information of Fullboar Creative, Corp.
// ("Confidential Information"). You shall not disclose such Confidential
// Information and shall use it only in accordance with the terms of the
// license agreement you entered into with Fullboar Creative, Corp.
//

/* eslint-env es6 */

'use strict';

export default (sequelize, DataTypes) => {
  const Agreement = sequelize.define('agreement', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.TEXT,
    },
    forestFileId: {
      field: 'forest_field_id',
      type: DataTypes.TEXT,
    },
    district: {
      type: DataTypes.TEXT,
    },
    agreementStartDate: {
      field: 'agreement_start_date',
      type: DataTypes.DATE,
    },
    agreementEndDate: {
      field: 'agreement_end_date',
      type: DataTypes.DATE,
    },
    planStartDate: {
      field: 'plan_start_date',
      type: DataTypes.DATE,
    },
    planEndDate: {
      field: 'plan_end_date',
      type: DataTypes.DATE,
    },
    nonUseBillable: {
      field: 'non_use_billable',
      type: DataTypes.BOOLEAN,
    },
    temporaryIncrease: {
      field: 'temporary_increase',
      type: DataTypes.DATE,
    },
    primaryHolder: {
      field: 'price_holder',
      type: DataTypes.TEXT,
    },
    holderTemp: {
      field: 'holder_temp',
      type: DataTypes.TEXT,
    },
    rupExempt: {
      field: 'rup_expempt',
      type: DataTypes.BOOLEAN,
    },
    storageL1: {
      field: 'storage_l1',
      type: DataTypes.TEXT,
    },
    storageL2: {
      field: 'storage_l2',
      type: DataTypes.TEXT,
    },
    storageL3: {
      field: 'storage_l3',
      type: DataTypes.TEXT,
    },
    storageL4: {
      field: 'storage_l4',
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    underscored: true,
    freezeTableName: true,
  });

  return Agreement;
};

