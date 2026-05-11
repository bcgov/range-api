import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import LivestockType from './livestocktype.js';

export default class GrazingScheduleEntry extends KyselyModel {
  declare id: number;
  declare graceDays: number;
  declare livestockCount: number;
  declare dateIn: string;
  declare dateOut: string;
  declare pastureId: number;
  declare livestockTypeId: number;
  declare grazingScheduleId: number;
  declare canonicalId: number;
  declare createdAt: string;
  declare livestockType: any;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.livestockType = new LivestockType(LivestockType.extract(data));
  }

  static get fields(): string[] {
    return [
      'id',
      'grace_days',
      'livestock_count',
      'date_in',
      'date_out',
      'pasture_id',
      'livestock_type_id',
      'grazing_schedule_id',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'grazing_schedule_entry';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithLivestockType(
    _db: any,
    where: Record<string, any>,
    order: any,
    orderRaw: boolean,
    page: any = undefined,
    limit: any = undefined,
  ) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'grazing_schedule_entry.id',
      'grazing_schedule_entry.grace_days',
      'grazing_schedule_entry.livestock_count',
      'grazing_schedule_entry.date_in',
      'grazing_schedule_entry.date_out',
      'grazing_schedule_entry.pasture_id',
      'grazing_schedule_entry.livestock_type_id',
      'grazing_schedule_entry.grazing_schedule_id',
      'grazing_schedule_entry.canonical_id',
      'grazing_schedule_entry.created_at',
      sql`ref_livestock.id`.as('ref_livestock_id'),
      sql`ref_livestock.name`.as('ref_livestock_name'),
      sql`ref_livestock.au_factor`.as('ref_livestock_au_factor'),
      sql`ref_livestock.active`.as('ref_livestock_active'),
      sql`pasture.id`.as('pasture_id'),
      sql`pasture.name`.as('pasture_name'),
      sql`pasture.allowable_aum`.as('pasture_allowable_aum'),
      sql`pasture.grace_days`.as('pasture_grace_days'),
      sql`pasture.pld_percent`.as('pasture_pld_percent'),
      sql`pasture.notes`.as('pasture_notes'),
      sql`pasture.plan_id`.as('pasture_plan_id'),
      sql`pasture.canonical_id`.as('pasture_canonical_id'),
      sql`pasture.created_at`.as('pasture_created_at'),
    ];
    let query: any = db
      .selectFrom('grazing_schedule_entry')
      .innerJoin('ref_livestock', 'grazing_schedule_entry.livestock_type_id', 'ref_livestock.id')
      .innerJoin('pasture', 'grazing_schedule_entry.pasture_id', 'pasture.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    if (orderRaw) {
      query = query.orderBy(sql.raw(order));
    } else if (order) {
      query = query.orderBy(order[0], order[1] || 'asc');
    }
    query = query.orderBy('grazing_schedule_entry.id', 'asc');
    if (page && limit) {
      const offset = limit * (page - 1);
      query = query.offset(offset).limit(limit);
    }
    const results = await query.execute();
    return results;
  }
}
