'use strict';

import Model from './model';

export default class MonitoringArea extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'health_id', 'plant_community_id', 'name',
      'location', 'transect_azimuth', 'latitude', 'longitude',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'monitoring_area';
  }
}
