import ExemptionAttachment from './exemptionattachment';
import Model from './model';
import User from './user';

export default class Exemption extends Model {
  constructor(data, trx = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Exemption.fields.indexOf(`${Exemption.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, trx);

    // Extract user who created the exemption
    this.user = new User(User.extract(data));

    // Extract user who approved the exemption (if exists)
    const approvedByData = {};
    Object.keys(data).forEach((key) => {
      if (key.startsWith('approved_by_user_')) {
        const cleanKey = key.replace('approved_by_user_', '');
        approvedByData[`${User.table}_${cleanKey}`] = data[key];
      }
    });
    if (Object.keys(approvedByData).length > 0 && approvedByData[`${User.table}_id`]) {
      this.approvedByUser = new User(User.extract(approvedByData));
    }
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
      'approved_by',
      'approval_date',
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
    const fields = [
      ...this.fields,
      ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map((f) => `approved_by_user.${f.split('.')[1]} AS approved_by_user_${f.split('.')[1]}`),
    ];
    const results = await trx
      .select(fields)
      .from(this.table)
      .leftJoin(User.table, {
        [`${this.table}.user_id`]: `${User.table}.id`,
      })
      .leftJoin(`${User.table} as approved_by_user`, {
        [`${this.table}.approved_by`]: `approved_by_user.id`,
      })
      .where('agreement_id', agreementId)
      .orderBy(orderBy, order);
    return Promise.all(
      results.map(async (row) => {
        const exemption = new Exemption(row);
        exemption.attachments = await ExemptionAttachment.findByExemptionId(trx, exemption.id);
        return exemption;
      }),
    );
  }

  static async findById(trx, exemptionId) {
    if (!trx || !exemptionId) {
      return null;
    }
    const fields = [
      ...this.fields,
      ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map((f) => `approved_by_user.${f.split('.')[1]} AS approved_by_user_${f.split('.')[1]}`),
    ];
    const row = await trx
      .select(fields)
      .from(this.table)
      .leftJoin(User.table, {
        [`${this.table}.user_id`]: `${User.table}.id`,
      })
      .leftJoin(`${User.table} as approved_by_user`, {
        [`${this.table}.approved_by`]: `approved_by_user.id`,
      })
      .where(`${this.table}.id`, exemptionId)
      .first();

    if (!row) {
      return null;
    }

    const exemption = new Exemption(row);
    exemption.attachments = await ExemptionAttachment.findByExemptionId(trx, exemption.id);
    return exemption;
  }
}
