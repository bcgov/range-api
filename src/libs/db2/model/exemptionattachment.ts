import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';

export default class ExemptionAttachment extends KyselyModel {
  declare user: User;
  constructor(data: Record<string, any>, _db?: any) {
    const obj: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (ExemptionAttachment.fields.indexOf(key) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, _db);

    this.user = new User(User.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'name', 'url', 'type', 'access', 'exemption_id', 'user_id', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'exemption_attachment';
  }

  static async findByExemptionId(_db: any, exemptionId: number) {
    const db = _db || kyselyDb;
    if (!db || !exemptionId) {
      return [];
    }

    const myFields = [
      ...ExemptionAttachment.fields.map((f) => `exemption_attachment.${f}`),
      ...User.fields.map((f: string) => sql`user_account.${sql.raw(f)}`.as(`user_account_${f}`)),
    ];

    const results = await db
      .selectFrom('exemption_attachment')
      .select(myFields)
      .leftJoin('user_account', 'exemption_attachment.user_id', 'user_account.id')
      .where('exemption_attachment.exemption_id', '=', exemptionId)
      .orderBy('exemption_attachment.created_at', 'asc')
      .execute();

    return results.map((row: Record<string, any>) => new ExemptionAttachment(row, db));
  }
}
