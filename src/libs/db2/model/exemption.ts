import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import ExemptionAttachment from './exemptionattachment.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';

export default class Exemption extends KyselyModel {
  declare id: number;
  declare agreementId: number;
  declare startDate: string;
  declare endDate: string;
  declare reason: string;
  declare justificationText: string;
  declare status: string;
  declare approvedBy: number;
  declare approvalDate: string;
  declare createdAt: string;
  declare updatedAt: string;
  user: any = null;
  approvedByUser: any = null;
  declare attachments: any[];
  constructor(data: Record<string, any>, _db?: any) {
    const obj: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (Exemption.fields.indexOf(key) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, _db);

    this.user = data.user_id ? new User(User.extract(data)) : null;

    const approvedByData: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (key.startsWith('approved_by_user_')) {
        const cleanKey = key.replace('approved_by_user_', '');
        approvedByData[cleanKey] = data[key];
      }
    });
    if (Object.keys(approvedByData).length > 0 && approvedByData.id) {
      this.approvedByUser = new User(approvedByData);
    }
  }

  static get fields(): string[] {
    return [
      'id',
      'agreement_id',
      'start_date',
      'end_date',
      'reason',
      'justification_text',
      'status',
      'approved_by',
      'approval_date',
      'created_at',
      'updated_at',
    ];
  }

  static get table(): string {
    return 'exemption';
  }

  static async findByAgreementId(_db: any, agreementId: number, orderBy: string = 'created_at', order: string = 'asc') {
    const db = _db || kyselyDb;
    if (!db || !agreementId) {
      return [];
    }

    const myFields: any[] = [
      ...Exemption.fields.map((f) => `exemption.${f}`),
      ...User.fields.map((f: string) => sql`user_account.${sql.raw(f)}`.as(`user_account_${f}`)),
      ...User.fields.map((f: string) => sql`approved_by_user.${sql.raw(f)}`.as(`approved_by_user_${f}`)),
    ];

    const results = await db
      .selectFrom('exemption')
      .select(myFields)
      .leftJoin('user_account', (join: any) => join.onRef('exemption.user_id', '=', 'user_account.id'))
      .leftJoin('user_account as approved_by_user', (join: any) =>
        join.onRef('exemption.approved_by', '=', 'approved_by_user.id'),
      )
      .where('exemption.agreement_id', '=', agreementId)
      .orderBy(orderBy, order)
      .execute();

    return Promise.all(
      results.map(async (row: any) => {
        const exemption = new Exemption(row, db);
        exemption.attachments = await ExemptionAttachment.findByExemptionId(db, exemption.id);
        return exemption;
      }),
    );
  }

  static async findById(_db: any, exemptionId: number) {
    const db = _db || kyselyDb;
    if (!db || !exemptionId) {
      return null;
    }

    const myFields: any[] = [
      ...Exemption.fields.map((f) => `exemption.${f}`),
      ...User.fields.map((f: string) => sql`user_account.${sql.raw(f)}`.as(`user_account_${f}`)),
      ...User.fields.map((f: string) => sql`approved_by_user.${sql.raw(f)}`.as(`approved_by_user_${f}`)),
    ];

    const row: any = await db
      .selectFrom('exemption')
      .select(myFields)
      .leftJoin('user_account', (join: any) => join.onRef('exemption.user_id', '=', 'user_account.id'))
      .leftJoin('user_account as approved_by_user', (join: any) =>
        join.onRef('exemption.approved_by', '=', 'approved_by_user.id'),
      )
      .where('exemption.id', '=', exemptionId)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const exemption = new Exemption(row, db);
    exemption.attachments = await ExemptionAttachment.findByExemptionId(db, exemption.id);
    return exemption;
  }
}
