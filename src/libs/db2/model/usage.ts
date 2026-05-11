import KyselyModel from './KyselyModel.js';

export default class Usage extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'year', 'authorized_aum', 'temporary_increase', 'total_non_use', 'total_annual_use', 'agreement_id'];
  }

  static get table(): string {
    return 'ref_usage';
  }
}
