'use strict';

import Model from './model';

export default class MonitoringAreaPurpose extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'purpose_type_id', 'monitoring_area_id',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'monitoring_area_purpose';
  }
}
