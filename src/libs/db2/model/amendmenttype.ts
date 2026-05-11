import KyselyModel from './KyselyModel.js';

export default class AmendmentType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'code', 'description', 'active'];
  }

  static get table(): string {
    return 'ref_amendment_type';
  }
}
