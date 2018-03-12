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
// Created by Jason Leach on 2018-03-10.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-unused-vars,arrow-body-style */
const table = 'usage';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;

    await queryInterface.createTable(table, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      year: {
        type: Sequelize.STRING(4),
        is: /^([0-9]){4}$/i,
        allowNull: false,
      },
      authorizedAum: {
        type: Sequelize.INTEGER,
        field: 'authorized_aum',
        allowNull: false,
      },
      temporaryIncrease: {
        type: Sequelize.INTEGER,
        field: 'temporary_increase',
        allowNull: false,
      },
      totalNonUse: {
        type: Sequelize.INTEGER,
        field: 'total_non_use',
        default: 0,
      },
      totalAnnualUse: {
        type: Sequelize.INTEGER,
        field: 'total_annual_use',
        default: 0,
      },
      agreement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'agreement',
          key: 'id',
          deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE,
        },
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'),
        allowNull: false,
      },
    });

    const query = `
    CREATE TRIGGER update_${table}_changetimestamp BEFORE UPDATE
    ON ${table} FOR EACH ROW EXECUTE PROCEDURE 
    update_changetimestamp_column();`;

    await queryInterface.sequelize.query(query);
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable(table);
  },
};
