'use strict';

import Model from './model';
import MonitoringAreaPurposeType from './monitoringareapurposetype';

export default class MonitoringAreaPurpose extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (
        MonitoringAreaPurpose.fields.indexOf(
          `${MonitoringAreaPurpose.table}.${key}`,
        ) > -1
      ) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.purposeType = new MonitoringAreaPurposeType(
      MonitoringAreaPurposeType.extract(data),
    );
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'purpose_type_id', 'monitoring_area_id', 'canonical_id'].map(
      (field) => `${this.table}.${field}`,
    );
  }

  static get table() {
    return 'monitoring_area_purpose';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...MonitoringAreaPurpose.fields,
      ...MonitoringAreaPurposeType.fields.map(
        (f) => `${f} AS ${f.replace('.', '_')}`,
      ),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(MonitoringAreaPurpose.table)
        .leftJoin('ref_monitoring_area_purpose_type', {
          'monitoring_area_purpose.purpose_type_id':
            'ref_monitoring_area_purpose_type.id',
        })
        .where(where)
        .orderBy('id', 'asc');

      return results.map((row) => new MonitoringAreaPurpose(row, db));
    } catch (error) {
      throw error;
    }
  }
}
