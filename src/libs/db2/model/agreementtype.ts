import KyselyModel from './KyselyModel.js';

export default class AgreementType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'active'];
  }

  static get table(): string {
    return 'ref_agreement_type';
  }
}
