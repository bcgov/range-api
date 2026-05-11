import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import MonitoringAreaPurposeType from './monitoringareapurposetype.js';

export default class MonitoringAreaPurpose extends KyselyModel {
  declare id: number;
  declare purposeTypeId: number;
  declare monitoringAreaId: number;
  declare canonicalId: number;
  declare purposeType: any;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.purposeType = new MonitoringAreaPurposeType(MonitoringAreaPurposeType.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'purpose_type_id', 'monitoring_area_id', 'canonical_id'];
  }

  static get table(): string {
    return 'monitoring_area_purpose';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'monitoring_area_purpose.id',
      'monitoring_area_purpose.purpose_type_id',
      'monitoring_area_purpose.monitoring_area_id',
      'monitoring_area_purpose.canonical_id',
      sql`ref_monitoring_area_purpose_type.id`.as('ref_monitoring_area_purpose_type_id'),
      sql`ref_monitoring_area_purpose_type.name`.as('ref_monitoring_area_purpose_type_name'),
      sql`ref_monitoring_area_purpose_type.active`.as('ref_monitoring_area_purpose_type_active'),
    ];
    let query: any = db
      .selectFrom('monitoring_area_purpose')
      .leftJoin(
        'ref_monitoring_area_purpose_type',
        'monitoring_area_purpose.purpose_type_id',
        'ref_monitoring_area_purpose_type.id',
      )
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('id', 'asc');
    const results = await query.execute();
    return results.map((row: any) => new MonitoringAreaPurpose(row, _db));
  }
}
