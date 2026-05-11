import KyselyModel from './KyselyModel.js';

export default class ExemptionStatusType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'active', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'exemption_status_type';
  }
}
