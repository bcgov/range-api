import KyselyModel from './KyselyModel.js';

export default class AgreementExemptionStatus extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'active'];
  }

  static get table(): string {
    return 'agreement_exemption_status';
  }
}
