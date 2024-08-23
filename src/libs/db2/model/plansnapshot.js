import { errorWithCode } from '@bcgov/nodejs-common-utils';
import Model from './model';
import User from './user';
import PlanStatus from './planstatus';
import { generatePDFResponse } from '../../../router/controllers_v1/PDFGeneration';
import Plan from './plan';
import PlanStatusHistory from './planstatushistory';

export default class PlanSnapshot extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlanSnapshot.fields.indexOf(`${PlanSnapshot.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.creator = new User(User.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'snapshot',
      'plan_id',
      'created_at',
      'version',
      'status_id',
      'user_id',
      'is_discarded',
      'pdf_file',
    ].map((f) => `${PlanSnapshot.table}.${f}`);
  }

  static get table() {
    return 'plan_snapshot';
  }

  static async findSummary(db, where, whereNotNull = undefined, order = undefined) {
    let results = [];
    const q = db.table('plan_snapshot_summary').select('*');
    if (Object.keys(where).length === 1 && where[Object.keys(where)[0]].constructor === Array) {
      const k = Object.keys(where)[0];
      const v = where[k];
      q.whereIn(k, v);
    } else {
      q.where(where);
    }
    if (whereNotNull) {
      q.whereNotNull(whereNotNull);
    }
    if (order && order.length > 0) {
      results = await q.orderBy(...order);
    } else {
      results = await q;
    }
    const objs = results.map((row) => {
      const obj = Object.create(this.prototype, {
        db: {
          enumerable: false,
          value: db,
          writable: false,
        },
      });
      Object.assign(obj, this.transformToCamelCase(row));
      return obj;
    });
    return objs;
  }

  async fetchStatus(db) {
    const status = await PlanStatus.findOne(db, { id: this.statusId });
    if (status) {
      this.status = status;
    }
  }

  static async create(db, values, user) {
    if (Plan.legalStatuses.indexOf(values.status_id) !== -1) {
      try {
        let originalApproval = await PlanStatusHistory.fetchOriginalApproval(db, values.plan_id, user);
        if (!originalApproval) {
          originalApproval = {
            familyName: user.familyName,
            givenName: user.givenName,
            createdAt: new Date().toISOString(),
          };
        }
        values.snapshot.originalApproval = originalApproval;
        const amendmentSubmissions = await PlanStatusHistory.fetchAmendmentSubmissions(db, values.plan_id);
        values.snapshot.amendmentSubmissions = amendmentSubmissions;
        const response = await generatePDFResponse(values.snapshot);
        values.pdf_file = response.data;
        values.snapshot = JSON.stringify(values.snapshot);
      } catch (error) {
        throw errorWithCode(`Error creating PDF file: ${JSON.stringify(error)}`, 500);
      }
    }
    console.log(`About to call super`);
    await super.create(db, values);
  }
}
