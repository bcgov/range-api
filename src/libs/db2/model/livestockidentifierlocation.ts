import KyselyModel from './KyselyModel.js';

export default class LivestockIdentifierLocation extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'description', 'active'];
  }

  static get table(): string {
    return 'ref_livestock_identifier_location';
  }
}
