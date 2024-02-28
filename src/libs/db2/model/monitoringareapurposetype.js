'use strict';

import Model from './model';

export default class MonitoringAreaPurposeType extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'name', 'active'].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'ref_monitoring_area_purpose_type';
  }
}
