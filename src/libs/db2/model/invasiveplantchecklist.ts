import KyselyModel from './KyselyModel.js';

export default class InvasivePlantChecklist extends KyselyModel {
  static get fields(): string[] {
    return [
      'id',
      'plan_id',
      'equipment_and_vehicles_parking',
      'begin_in_uninfested_area',
      'undercarriges_inspected',
      'revegetate',
      'other',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'invasive_plant_checklist';
  }
}
