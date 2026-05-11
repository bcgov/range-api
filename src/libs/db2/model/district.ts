import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class District extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'user_id'];
  }

  static get table(): string {
    return 'ref_district';
  }

  static async update(_db: any, where: Record<string, any>, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      obj[District.toSnakeCase(key)] = values[key];
    });
    let query = db.updateTable(District.table).set(obj);
    Object.entries(where).forEach(([k, v]) => {
      query = query.where(k, '=', v);
    });
    await query.execute();
    return [];
  }

  static async updateMultiple(_db: any, where: Record<string, any>, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      obj[District.toSnakeCase(key)] = values[key];
    });
    await db.updateTable(District.table).set(obj).where('id', 'in', where.ids).execute();
    return [];
  }

  static async removeDistricts(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    await db.updateTable(District.table).set({ user_id: null }).where('user_id', '=', where.user_id).execute();
    return [];
  }
}
