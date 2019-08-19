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

'use strict';

import { flatten } from 'lodash';
import Model from './model';
import PlantCommunity from './plantcommunity';

export default class Pasture extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Pasture.fields.indexOf(`${Pasture.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'name', 'allowable_aum', 'grace_days', 'pld_percent',
      'notes', 'plan_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'pasture';
  }

  async fetchPlantCommunities(db, where) {
    const plantCommunities = await PlantCommunity.findWithElevationAndType(db, where);

    const promises = plantCommunities.map(p =>
      [
        p.fetchIndicatorPlants(this.db, { plant_community_id: p.id }),
        p.fetchMonitoringAreas(this.db, { plant_community_id: p.id }),
        p.fetchPlantCommunityActions(this.db, { plant_community_id: p.id }),
      ]);

    await Promise.all(flatten(promises));

    this.plantCommunities = plantCommunities || [];
  }
}
