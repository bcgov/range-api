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
// Created by Jason Leach on 2018-04-03.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-unused-vars,arrow-body-style */
const table = 'ref_zone';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;

    await queryInterface.addColumn(
      table,
      'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'user_account',
          key: 'id',
          deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn(table, 'user_id');
  },
};
