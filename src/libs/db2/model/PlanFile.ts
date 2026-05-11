import KyselyModel from './KyselyModel.js';

export default class PlanFile extends KyselyModel {
  constructor(data: Record<string, any>, db?: any) {
    super(data, db);
  }

  static get fields(): string[] {
    return ['id', 'name', 'url', 'type', 'plan_id', 'user_id', 'access', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'plan_file';
  }
}
