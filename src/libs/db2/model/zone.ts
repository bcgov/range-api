import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import District from './district.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';

export default class Zone extends KyselyModel {
  declare district: District;
  user: any = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);

    this.district = new District(District.extract(data));

    this.user = data.user_id ? new User(User.extract(data)) : null;
  }

  static get fields(): string[] {
    return ['id', 'code', 'description', 'district_id', 'user_id'];
  }

  static get table(): string {
    return 'ref_zone';
  }

  static async searchForTerm(_db: any, term: string) {
    const db = _db || kyselyDb;
    if (!db || !term) {
      return [];
    }

    const results = await db
      .selectFrom('ref_zone')
      .select('ref_zone.id')
      .innerJoin('user_account', 'ref_zone.user_id', 'user_account.id')
      .where(sql`user_account.given_name || ' ' || user_account.family_name`, 'ilike', `%${term}%`)
      .execute();

    return results.flatMap((result: Record<string, any>) => Object.values(result));
  }

  static async findWithDistrictUser(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const myFields = [
      ...Zone.fields.map((f) => `ref_zone.${f}`),
      ...District.fields.map((f: string) => sql`ref_district.${sql.raw(f)}`.as(`ref_district_${f}`)),
      ...User.fields.map((f: string) => sql`user_account.${sql.raw(f)}`.as(`user_account_${f}`)),
    ];

    const results = await db
      .selectFrom('ref_zone')
      .select(myFields)
      .innerJoin('ref_district', (join: any) => join.onRef('ref_zone.district_id', '=', 'ref_district.id'))
      .leftJoin('user_account', (join: any) => join.onRef('ref_zone.user_id', '=', 'user_account.id'))
      .$call((qb: any) => {
        let query = qb;
        Object.entries(where).forEach(([k, v]) => {
          query = query.where(k, '=', v);
        });
        return query;
      })
      .orderBy('ref_zone.user_id', 'desc')
      .execute();

    return results.map((row: Record<string, any>) => new Zone(row, db));
  }
}
