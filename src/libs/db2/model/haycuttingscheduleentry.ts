import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class HayCuttingScheduleEntry extends KyselyModel {
  static get fields(): string[] {
    return [
      'id',
      'date_in',
      'date_out',
      'pasture_id',
      'stubble_height',
      'tonnes',
      'haycutting_schedule_id',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'haycutting_schedule_entry';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithOrder(
    _db: any,
    where: Record<string, any>,
    order: any,
    orderRaw: boolean,
    page?: number,
    limit?: number,
  ) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'haycutting_schedule_entry.id',
      'haycutting_schedule_entry.date_in',
      'haycutting_schedule_entry.date_out',
      'haycutting_schedule_entry.pasture_id',
      'haycutting_schedule_entry.stubble_height',
      'haycutting_schedule_entry.tonnes',
      'haycutting_schedule_entry.haycutting_schedule_id',
      'haycutting_schedule_entry.canonical_id',
      'haycutting_schedule_entry.created_at',
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
      .selectFrom('haycutting_schedule_entry')
      .innerJoin('pasture', 'haycutting_schedule_entry.pasture_id', 'pasture.id')
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
    query = query.orderBy('haycutting_schedule_entry.id', 'asc');
    if (page && limit) {
      const offset = limit * (page - 1);
      query = query.offset(offset).limit(limit);
    }
    const results = await query.execute();
    return results;
  }
}
