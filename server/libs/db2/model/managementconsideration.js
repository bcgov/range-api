'use strict';

import Model from './model';

export default class ManagementConsideration extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'url', 'type_id', 'plan_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'management_consideration';
  }
}
