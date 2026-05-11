import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';

export default class PlanStatusHistory extends KyselyModel {
  declare id: any;
  declare planId: any;
  declare fromPlanStatusId: any;
  declare toPlanStatusId: any;
  declare userId: any;
  declare note: any;
  declare createdAt: any;
  declare updatedAt: any;
  declare user: User;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.user = new User(User.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'plan_id', 'from_plan_status_id', 'to_plan_status_id', 'user_id', 'note', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'plan_status_history';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithUser(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields = [
      'plan_status_history.id',
      'plan_status_history.plan_id',
      'plan_status_history.from_plan_status_id',
      'plan_status_history.to_plan_status_id',
      'plan_status_history.user_id',
      'plan_status_history.note',
      'plan_status_history.created_at',
      'plan_status_history.updated_at',
      sql`user_account.id`.as('user_account_id'),
      sql`user_account.username`.as('user_account_username'),
      sql`user_account.given_name`.as('user_account_given_name'),
      sql`user_account.family_name`.as('user_account_family_name'),
      sql`user_account.email`.as('user_account_email'),
      sql`user_account.active`.as('user_account_active'),
      sql`user_account.role_id`.as('user_account_role_id'),
    ];
    let query: any = db
      .selectFrom('plan_status_history')
      .innerJoin('user_account', 'plan_status_history.user_id', 'user_account.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('created_at', 'desc');
    const results = await query.execute();
    return results.map((row: Record<string, any>) => new PlanStatusHistory(row, _db));
  }
}
