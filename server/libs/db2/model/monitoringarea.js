'use strict';

import Model from './model';
import MonitoringAreaHealth from './monitoringareahealth';
import MonitoringAreaPurpose from './monitoringareapurpose';

export default class MonitoringArea extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (MonitoringArea.fields.indexOf(`${MonitoringArea.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.rangelandHealth = data.rangeland_health_id
      ? new MonitoringAreaHealth(MonitoringAreaHealth.extract(data))
      : null;
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'rangeland_health_id', 'plant_community_id', 'name', 'other_purpose',
      'location', 'transect_azimuth', 'latitude', 'longitude',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'monitoring_area';
  }

  static async findWithHealth(db, where) {
    const myFields = [
      ...MonitoringArea.fields,
      ...MonitoringAreaHealth.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(MonitoringArea.table)
        .leftJoin('ref_monitoring_area_health', { 'monitoring_area.rangeland_health_id': 'ref_monitoring_area_health.id' })
        .where(where)
        .orderBy('id', 'asc');

      return results.map(row => new MonitoringArea(row, db));
    } catch (error) {
      throw error;
    }
  }

  async fetchMonitoringAreaPurposes(db, where) {
    const monitoringAreaPurposes = await MonitoringAreaPurpose.findWithType(db, where);
    this.purposes = monitoringAreaPurposes || [];
  }
}
