import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import ManagementConsiderationType from './managementconsiderationtype.js';

export default class ManagementConsideration extends KyselyModel {
  declare id: any;
  declare detail: any;
  declare url: any;
  declare considerationTypeId: any;
  declare planId: any;
  declare canonicalId: any;
  declare createdAt: any;
  considerationType: ManagementConsiderationType | null = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.considerationType = data.consideration_type_id
      ? new ManagementConsiderationType(ManagementConsiderationType.extract(data))
      : null;
  }

  static get fields(): string[] {
    return ['id', 'detail', 'url', 'consideration_type_id', 'plan_id', 'canonical_id', 'created_at'];
  }

  static get table(): string {
    return 'management_consideration';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields = [
      'management_consideration.id',
      'management_consideration.detail',
      'management_consideration.url',
      'management_consideration.consideration_type_id',
      'management_consideration.plan_id',
      'management_consideration.canonical_id',
      'management_consideration.created_at',
      sql`ref_management_consideration_type.id`.as('ref_management_consideration_type_id'),
      sql`ref_management_consideration_type.name`.as('ref_management_consideration_type_name'),
      sql`ref_management_consideration_type.active`.as('ref_management_consideration_type_active'),
    ];
    let query: any = db
      .selectFrom('management_consideration')
      .leftJoin(
        'ref_management_consideration_type',
        'management_consideration.consideration_type_id',
        'ref_management_consideration_type.id',
      )
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('management_consideration.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: Record<string, any>) => new ManagementConsideration(row, _db));
  }
}
