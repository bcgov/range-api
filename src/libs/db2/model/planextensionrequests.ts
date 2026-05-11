import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class PlanExtensionRequests extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'plan_id', 'client_id', 'user_id', 'email', 'requested_extension', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'plan_extension_requests';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static mapRow(row: Record<string, any>): Record<string, any> {
    return {
      id: row.id,
      planId: row.plan_id,
      clientId: row.client_id,
      userId: row.user_id,
      email: row.email,
      requestedExtension: row.requested_extension,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findWithExclusion(_db: any, where: Record<string, any>, exclude?: [string, any]) {
    const db = _db || kyselyDb;
    let query: any = db.selectFrom('plan_extension_requests').selectAll();
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    if (exclude) {
      query = query.where(exclude[0], '!=', exclude[1]);
    }
    const results = await query.execute();
    return results.map(PlanExtensionRequests.mapRow);
  }
}
