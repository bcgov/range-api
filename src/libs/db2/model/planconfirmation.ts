import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import Agreement from './agreement.js';

export default class PlanConfirmation extends KyselyModel {
  static get fields(): string[] {
    return [
      'id',
      'plan_id',
      'client_id',
      'confirmed',
      'created_at',
      'updated_at',
      'user_id',
      'is_own_signature',
      'is_manual_confirmation',
    ];
  }

  static get table(): string {
    return 'plan_confirmation';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async createConfirmations(_db: any, agreementId: string, planId: number) {
    const db = _db || kyselyDb;
    const agreement: any = await Agreement.findOne(db, { forest_file_id: agreementId });
    await agreement.fetchClients();
    const promises = agreement.clients.map((client: any) =>
      PlanConfirmation.create(db, { plan_id: planId, client_id: client.clientNumber, confirmed: false }),
    );
    const records = await Promise.all(promises);
    return records;
  }

  static async refreshConfirmations(_db: any, planId: number, user: any) {
    const db = _db || kyselyDb;
    const confirmations = await PlanConfirmation.find(db, { plan_id: planId });
    const promises = confirmations.map((c: any) => {
      const confirmed = c.clientId === user.clientId;
      return PlanConfirmation.update(db, { id: c.id }, { confirmed });
    });
    const records = await Promise.all(promises);
    return records;
  }
}
