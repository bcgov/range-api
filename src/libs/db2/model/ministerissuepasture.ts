import KyselyModel from './KyselyModel.js';

export default class MinisterIssuePasture extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'minister_issue_id', 'pasture_id', 'canonical_id'];
  }

  static get table(): string {
    return 'minister_issue_pasture';
  }
}
