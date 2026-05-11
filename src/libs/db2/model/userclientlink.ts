import KyselyModel from './KyselyModel.js';

export default class UserClientLink extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'user_id', 'client_id', 'active', 'type', 'created_at', 'updated_at'];
  }

  static get table(): string {
    return 'user_client_link';
  }
}
