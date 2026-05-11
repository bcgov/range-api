import KyselyModel from './KyselyModel.js';

export default class ManagementConsiderationType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_management_consideration_type';
  }
}
