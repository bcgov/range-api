'use strict';

import Model from './model';

export default class InvasivePlantChecklist extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'plan_id', 'equipment_and_vehicles_parking', 'begin_in_uninfested_area',
      'undercarriges_inspected', 'revegetate', 'other', 'canonical_id',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'invasive_plant_checklist';
  }
}
