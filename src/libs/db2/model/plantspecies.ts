import KyselyModel from './KyselyModel.js';

export default class PlantSpecies extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'leaf_stage', 'stubble_height', 'annual_growth', 'active', 'is_shrub_use'];
  }

  static get table(): string {
    return 'ref_plant_species';
  }
}
