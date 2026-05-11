import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import MonitoringAreaHealth from './monitoringareahealth.js';
import MonitoringAreaPurpose from './monitoringareapurpose.js';

export default class MonitoringArea extends KyselyModel {
  declare id: number;
  declare rangelandHealthId: number;
  declare plantCommunityId: number;
  declare name: string;
  declare otherPurpose: string;
  declare location: string;
  declare transectAzimuth: number;
  declare latitude: number;
  declare longitude: number;
  declare canonicalId: number;
  declare createdAt: string;
  rangelandHealth: any = null;
  purposes: any[] | null = null;
  purposeTypeIds: number[] | null = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.rangelandHealth = data.rangeland_health_id
      ? new MonitoringAreaHealth(MonitoringAreaHealth.extract(data))
      : null;
  }

  static get fields(): string[] {
    return [
      'id',
      'rangeland_health_id',
      'plant_community_id',
      'name',
      'other_purpose',
      'location',
      'transect_azimuth',
      'latitude',
      'longitude',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'monitoring_area';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithHealth(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'monitoring_area.id',
      'monitoring_area.rangeland_health_id',
      'monitoring_area.plant_community_id',
      'monitoring_area.name',
      'monitoring_area.other_purpose',
      'monitoring_area.location',
      'monitoring_area.transect_azimuth',
      'monitoring_area.latitude',
      'monitoring_area.longitude',
      'monitoring_area.canonical_id',
      'monitoring_area.created_at',
      sql`ref_monitoring_area_health.id`.as('ref_monitoring_area_health_id'),
      sql`ref_monitoring_area_health.name`.as('ref_monitoring_area_health_name'),
      sql`ref_monitoring_area_health.active`.as('ref_monitoring_area_health_active'),
    ];
    let query: any = db
      .selectFrom('monitoring_area')
      .leftJoin('ref_monitoring_area_health', 'monitoring_area.rangeland_health_id', 'ref_monitoring_area_health.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('monitoring_area.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: any) => new MonitoringArea(row, _db));
  }

  async fetchMonitoringAreaPurposes(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const monitoringAreaPurposes = await MonitoringAreaPurpose.findWithType(db, where);
    this.purposes = monitoringAreaPurposes || [];
    this.purposeTypeIds = (this.purposes || []).map((p: any) => p.purposeTypeId);
  }
}
