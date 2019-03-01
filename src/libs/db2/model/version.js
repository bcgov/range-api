'use strict';

import Model from './model';

export default class Version extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['lock', 'ios', 'api', 'idp_hint']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'version';
  }
}
