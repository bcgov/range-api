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
// Created by Jason Leach on 2018-05-10.
//

'use strict';

import GrazingScheduleEntry from './grazingscheduleentry';
import Model from './model';

export default class GrazingSchedule extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'year', 'narative', 'plan_id', 'canonical_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'grazing_schedule';
  }

  // eslint-disable-next-line class-methods-use-this
  async fetchGrazingSchedulesEntries() {
    const order = ['id', 'desc'];
    const where = { grazing_schedule_id: this.id };
    const entries = await GrazingScheduleEntry.findWithLivestockType(this.db, where, order);
    this.grazingScheduleEntries = entries;
  }
}
