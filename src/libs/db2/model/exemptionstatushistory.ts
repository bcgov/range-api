import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class ExemptionStatusHistory extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'exemption_id', 'from_status', 'to_status', 'note', 'user_id', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'exemption_status_history';
  }

  static async findByExemptionId(_db: any, exemptionId: number, options: Record<string, any> = {}) {
    const db = _db || kyselyDb;
    if (!db || !exemptionId) return [];

    const myFields = [
      ...ExemptionStatusHistory.fields.map((f) => `exemption_status_history.${f}`),
      'user_account.given_name',
      'user_account.family_name',
    ];

    let query: any = db
      .selectFrom('exemption_status_history')
      .select(myFields)
      .leftJoin('user_account', 'exemption_status_history.user_id', 'user_account.id')
      .where('exemption_status_history.exemption_id', '=', exemptionId);

    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc');
    } else {
      query = query.orderBy('exemption_status_history.created_at', 'desc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.execute();
    return results.map((row: Record<string, any>) => new ExemptionStatusHistory(row, db));
  }

  static async findByAgreementId(_db: any, agreementId: number, options: Record<string, any> = {}) {
    const db = _db || kyselyDb;
    if (!db || !agreementId) {
      return [];
    }

    const myFields = [
      ...ExemptionStatusHistory.fields.map((f) => `exemption_status_history.${f}`),
      sql`exemption_status_type.code`.as('to_status_code'),
      sql`exemption_status_type.description`.as('to_status_description'),
      'user_account.given_name',
      'user_account.family_name',
    ];

    let query: any = db
      .selectFrom('exemption_status_history')
      .select(myFields)
      .leftJoin('exemption_status_type', (join: any) =>
        join.onRef('exemption_status_history.to_status', '=', 'exemption_status_type.code'),
      )
      .leftJoin('user_account', (join: any) => join.onRef('exemption_status_history.user_id', '=', 'user_account.id'))
      .leftJoin('exemption', (join: any) => join.onRef('exemption_status_history.exemption_id', '=', 'exemption.id'))
      .where('exemption.agreement_id', '=', agreementId);

    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc');
    } else {
      query = query.orderBy('exemption_status_history.created_at', 'desc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const results = await query.execute();
    return results.map((row: Record<string, any>) => new ExemptionStatusHistory(row, db));
  }
}
