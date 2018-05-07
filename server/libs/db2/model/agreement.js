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
// Created by Jason Leach on 2018-05-04.
//

/* eslint-env es6 */

'use strict';

import Model from './model';

export default class Agreement extends Model {
  static get fields() {
    return ['forest_file_id', 'agreement_start_date', 'agreement_end_date', 'zone_id', 'agreement_type_id',
      'agreement_exemption_status_id'];
  }

  static get table() {
    return 'agreement';
  }

  static async find(db, ...where) {
    return db.table(Agreement.table)
      .where(...where)
      .select(...Agreement.fields)
      .then(rows => rows.map(row => new Agreement(row)));
  }
}
