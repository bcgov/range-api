import KyselyModel from './KyselyModel.js';

export default class AdditionalRequirementCategory extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_additional_requirement_category';
  }
}
