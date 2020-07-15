'use strict';

import Model from './model';

export default class PlanFile extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlanFile.fields.indexOf(`${PlanFile.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'name', 'url', 'type', 'plan_id', 'user_id', 'access']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plan_file';
  }
}
