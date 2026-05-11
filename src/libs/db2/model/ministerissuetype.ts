import KyselyModel from './KyselyModel.js';

export default class MinisterIssueType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_minister_issue_type';
  }
}
