import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import District from './district.js';

export default class UserDistricts extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'user_id'];
  }

  static get table(): string {
    return 'user_districts';
  }

  static async createOneOrMany(_db: any, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const id = values.user_id;
    const districts = values.districts;
    const objs: Record<string, any>[] = [];

    districts.forEach((district: Record<string, any>) => {
      const obj: Record<string, any> = {};
      Object.keys(district).forEach((key) => {
        obj[UserDistricts.toSnakeCase(key)] = district[key];
      });
      obj.user_id = id;
      objs.push(obj);
    });

    if (objs.length === 0) return [];

    await db.insertInto(UserDistricts.table).values(objs).execute();
    return [];
  }

  static async removeDistricts(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    await db.deleteFrom(UserDistricts.table).where('user_id', '=', where.user_id).execute();
    return [];
  }

  static async findDistrictsForUser(_db: any, userId: number) {
    const db = _db || kyselyDb;
    return await db
      .selectFrom(UserDistricts.table)
      .leftJoin(District.table, 'user_districts.id', 'ref_district.id')
      .selectAll()
      .where('user_districts.user_id', '=', userId)
      .execute();
  }
}
