import KyselyModel from './KyselyModel.js';

export default class ClientType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'active'];
  }

  static get table(): string {
    return 'ref_client_type';
  }
}
