import KyselyModel from './KyselyModel.js';

export default class MinisterIssueActionType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active', 'placeholder'];
  }

  static get table(): string {
    return 'ref_minister_issue_action_type';
  }
}
