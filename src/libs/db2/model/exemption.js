import Model from './model';

export default class Exemption extends Model {
  static get fields() {
    return [
      'id',
      'agreement_id',
      'start_date',
      'end_date',
      'reason',
      'justification_text',
      'status',
      'created_at',
      'updated_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'exemption';
  }

  static findByAgreementId(db, agreementId) {
    return db(this.table).where('agreement_id', agreementId);
  }
}
