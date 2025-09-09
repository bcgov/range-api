import Model from './model';

export default class Exemption extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Exemption.fields.indexOf(`${Exemption.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

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

  static async findByAgreementId(trx, agreementId, orderBy = 'created_at', order = 'asc') {
    if (!trx || !agreementId) {
      return [];
    }

    const results = await trx
      .select([...this.fields, 'user_account.given_name', 'user_account.family_name'])
      .from(this.table)
      .leftJoin('user_account', {
        [`${this.table}.user_id`]: 'user_account.id',
      })
      .where('agreement_id', agreementId)
      .orderBy(orderBy, order);
    return results.map((row) => new Exemption(row));
  }
}
