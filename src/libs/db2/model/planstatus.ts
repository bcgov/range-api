import KyselyModel from './KyselyModel.js';

export default class PlanStatus extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_plan_status';
  }
}
