'use strict';

import Model from './model';
import PlantCommunityAction from './plantcommunityaction';
import PlantCommunityElevation from './plantcommunityelevation';
import PlantCommunityType from './plantcommunitytype';
import IndicatorPlant from './indicatorplant';
import MonitoringArea from './monitoringarea';

export default class PlantCommunity extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlantCommunity.fields.indexOf(`${PlantCommunity.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.elevation = data.elevation_id
      ? this.elevation = new PlantCommunityElevation(PlantCommunityElevation.extract(data))
      : null;

    this.communityType = new PlantCommunityType(
      PlantCommunityType.extract(data),
    );
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'community_type_id', 'elevation_id', 'pasture_id',
      'purpose_of_action', 'name', 'aspect', 'url', 'notes',
      'range_readiness_day', 'range_readiness_month', 'range_readiness_note',
      'approved', 'shrub_use', 'canonical_id', 'created_at',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plant_community';
  }

  static async findWithElevationAndType(db, where) {
    const myFields = [
      ...PlantCommunity.fields,
      ...PlantCommunityType.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...PlantCommunityElevation.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(PlantCommunity.table)
        .join('ref_plant_community_type', { 'plant_community.community_type_id': 'ref_plant_community_type.id' })
        .leftJoin('ref_plant_community_elevation', { 'plant_community.elevation_id': 'ref_plant_community_elevation.id' })
        .where(where)
        .orderBy('plant_community.created_at', 'asc');

      return results.map(row => new PlantCommunity(row, db));
    } catch (error) {
      throw error;
    }
  }

  async fetchIndicatorPlants(db, where) {
    const indicatorPlants = await IndicatorPlant.findWithType(db, where);
    this.indicatorPlants = indicatorPlants || [];
  }

  async fetchMonitoringAreas(db, where) {
    const monitoringAreas = await MonitoringArea.findWithHealth(db, where);

    const promises = monitoringAreas
      .map(ma => ma.fetchMonitoringAreaPurposes(this.db, { monitoring_area_id: ma.id }));

    await Promise.all(promises);

    this.monitoringAreas = monitoringAreas || [];
  }

  async fetchPlantCommunityActions(db, where) {
    const plantCommunityActions = await PlantCommunityAction.findWithType(db, where);
    this.plantCommunityActions = plantCommunityActions || [];
  }
}
