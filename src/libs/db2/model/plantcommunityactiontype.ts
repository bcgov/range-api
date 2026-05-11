import KyselyModel from './KyselyModel.js';

export default class PlantCommunityActionType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_plant_community_action_type';
  }
}
