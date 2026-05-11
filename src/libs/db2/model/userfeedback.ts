import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';

export default class UserFeedback extends KyselyModel {
  user: any = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.user = data.user_id ? new User(User.extract(data)) : null;
  }

  static get fields(): string[] {
    return ['id', 'user_id', 'feedback', 'section'];
  }

  static get table(): string {
    return 'user_feedback';
  }

  static async findWithUser(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const myFields = [
      ...UserFeedback.fields.map((f) => `user_feedback.${f}`),
      ...User.fields.map((f: string) => sql`user_account.${sql.raw(f)}`.as(`user_account_${f}`)),
    ];

    const results = await db
      .selectFrom('user_feedback')
      .select(myFields)
      .leftJoin('user_account', 'user_feedback.user_id', 'user_account.id')
      .$call((qb: any) => {
        let query = qb;
        Object.entries(where).forEach(([k, v]) => {
          query = query.where(k, '=', v);
        });
        return query;
      })
      .execute();

    return results.map((row: Record<string, any>) => new UserFeedback(row, db));
  }
}
