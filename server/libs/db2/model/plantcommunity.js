'use strict';

import Model from './model';

export default class PlantCommunity extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlantCommunity.fields.indexOf(`${PlantCommunity.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    // this.ministerIssueActionType = new MinisterIssueActionType(
    //   MinisterIssueActionType.extract(data),
    // );
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'elevation_id', 'pasture_id', 'purpose_of_action',
      'name', 'aspect', 'url', 'notes', 'range_readiness_day',
      'range_readiness_month', 'range_readiness_note',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plant_community';
  }
}
