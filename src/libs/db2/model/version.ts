import KyselyModel from './KyselyModel.js';

export default class Version extends KyselyModel {
  static get fields(): string[] {
    return ['lock', 'ios', 'api', 'idp_hint'];
  }

  static get table(): string {
    return 'version';
  }
}
