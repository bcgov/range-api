'use strict';

import Model from './model';
import ManagementConsiderationType from './managementconsiderationtype';

export default class ManagementConsideration extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (ManagementConsideration.fields.indexOf(`${ManagementConsideration.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.considerationType = data.consideration_type_id
      ? new ManagementConsiderationType(ManagementConsiderationType.extract(data))
      : null;
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'url', 'consideration_type_id', 'plan_id', 'canonical_id', 'created_at'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static get table() {
    return 'management_consideration';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...ManagementConsideration.fields,
      ...ManagementConsiderationType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];

    const results = await db
      .select(myFields)
      .from(ManagementConsideration.table)
      .leftJoin('ref_management_consideration_type', {
        'management_consideration.consideration_type_id': 'ref_management_consideration_type.id',
      })
      .where(where)
      .orderBy('management_consideration.created_at', 'asc');

    return results.map((row) => new ManagementConsideration(row, db));
  }
}
