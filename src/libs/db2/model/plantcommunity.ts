import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import PlantCommunityElevation from './plantcommunityelevation.js';
import PlantCommunityType from './plantcommunitytype.js';
import IndicatorPlant from './indicatorplant.js';
import MonitoringArea from './monitoringarea.js';
import PlantCommunityAction from './plantcommunityaction.js';

export default class PlantCommunity extends KyselyModel {
  declare id: number;
  declare communityTypeId: number;
  declare elevationId: number;
  declare pastureId: number;
  declare purposeOfAction: string;
  declare name: string;
  declare aspect: string;
  declare url: string;
  declare notes: string;
  declare rangeReadinessDay: number;
  declare rangeReadinessMonth: number;
  declare rangeReadinessNote: string;
  declare approved: boolean;
  declare shrubUse: string;
  declare canonicalId: number;
  declare createdAt: string;
  elevation: any = null;
  declare communityType: any;
  indicatorPlants: any[] | null = null;
  monitoringAreas: any[] | null = null;
  plantCommunityActions: any[] | null = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.elevation = data.elevation_id ? new PlantCommunityElevation(PlantCommunityElevation.extract(data)) : null;
    this.communityType = new PlantCommunityType(PlantCommunityType.extract(data));
  }

  static get fields(): string[] {
    return [
      'id',
      'community_type_id',
      'elevation_id',
      'pasture_id',
      'purpose_of_action',
      'name',
      'aspect',
      'url',
      'notes',
      'range_readiness_day',
      'range_readiness_month',
      'range_readiness_note',
      'approved',
      'shrub_use',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'plant_community';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithElevationAndType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      ...PlantCommunity.fields.map((f) => `plant_community.${f}`),
      sql`ref_plant_community_type.id`.as('ref_plant_community_type_id'),
      sql`ref_plant_community_type.name`.as('ref_plant_community_type_name'),
      sql`ref_plant_community_type.active`.as('ref_plant_community_type_active'),
      sql`ref_plant_community_elevation.id`.as('ref_plant_community_elevation_id'),
      sql`ref_plant_community_elevation.name`.as('ref_plant_community_elevation_name'),
      sql`ref_plant_community_elevation.active`.as('ref_plant_community_elevation_active'),
    ];
    let query: any = db
      .selectFrom('plant_community')
      .innerJoin('ref_plant_community_type', 'plant_community.community_type_id', 'ref_plant_community_type.id')
      .leftJoin('ref_plant_community_elevation', 'plant_community.elevation_id', 'ref_plant_community_elevation.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('plant_community.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: any) => new PlantCommunity(row, _db));
  }

  async fetchIndicatorPlants(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const indicatorPlants = await IndicatorPlant.findWithType(db, where);
    this.indicatorPlants = indicatorPlants || [];
  }

  async fetchMonitoringAreas(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const monitoringAreas = await MonitoringArea.findWithHealth(db, where);
    const promises = monitoringAreas.map((ma: any) =>
      ma.fetchMonitoringAreaPurposes(db, { monitoring_area_id: ma.id }),
    );
    await Promise.all(promises);
    this.monitoringAreas = monitoringAreas || [];
  }

  async fetchPlantCommunityActions(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const plantCommunityActions = await PlantCommunityAction.findWithType(db, where);
    this.plantCommunityActions = plantCommunityActions || [];
  }
}
