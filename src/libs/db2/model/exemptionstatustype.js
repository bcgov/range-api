import Model from './model';

export default class ExemptionStatusType extends Model {
  static get fields() {
    return ['id', 'code', 'description', 'active', 'created_at', 'updated_at'].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'exemption_status_type';
  }
}
