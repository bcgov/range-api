import KyselyModel from './KyselyModel.js';

export default class MonitoringAreaPurposeType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'active'];
  }

  static get table(): string {
    return 'ref_monitoring_area_purpose_type';
  }
}
