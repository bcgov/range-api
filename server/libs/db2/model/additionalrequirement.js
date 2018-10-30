'use strict';

import Model from './model';

export default class AdditionalRequirement extends Model {
  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'url', 'category_id', 'plan_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'additional_requirement';
  }
}
