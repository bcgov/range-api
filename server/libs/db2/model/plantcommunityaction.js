'use strict';

import Model from './model';

export default class PlantCommunityAction extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'plant_community_id', 'action_type_id',
      'name', 'details', 'no_graze_start_day',
      'no_graze_start_month', 'no_graze_end_day', 'no_graze_end_month',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plant_community_action';
  }
}
