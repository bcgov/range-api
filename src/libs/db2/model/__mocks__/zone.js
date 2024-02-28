//
// Code Sign
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
// Created by Jason Leach on 2018-07-23.
//

/* eslint-disable no-unused-vars */

'use strict';

import assert from 'assert';
import Model from '../model';

export default class Zone extends Model {
  static async findWithDistrictUser(db, where) {
    return [
      { id: 1, data: 'Lao is here' },
      { id: 2, data: 'Lao is good' },
    ];
  }

  static async searchForTerm(db, term) {
    assert(db);
    assert(term);
    return [1, 2, 3];
  }

  static async find(db, where) {
    assert(db);
    assert(where);
    assert(Object.keys(where).length > 0);

    return [
      { id: 1, data: 'Lao is here' },
      { id: 2, data: 'Lao is good' },
    ];
  }
}
