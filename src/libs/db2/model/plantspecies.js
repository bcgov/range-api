'use strict';

import Model from './model';

export default class PlantSpecies extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'name', 'leaf_stage', 'stubble_height',
      'annual_growth', 'active', 'is_shrub_use',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'ref_plant_species';
  }
}
