import KyselyModel from './KyselyModel.js';

export default class ClientAgreement extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'agreement_id', 'client_id', 'client_type_id', 'agent_id'];
  }

  static get table(): string {
    return 'client_agreement';
  }

  static get primaryKey(): string {
    return 'id';
  }
}
