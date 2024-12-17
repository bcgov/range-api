import { errorWithCode } from '@bcgov/nodejs-common-utils';
import Model from './model';
import User from './user';
import PlanStatus from './planstatus';
import Plan from './plan';
import AmendmentType from './amendmenttype';

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

  static async fetchAmendmentSubmissions(db, planId, startDate) {
    const amendmentTypeArray = [];
    const amendmentTypeRows = await AmendmentType.find(db, {});
    amendmentTypeRows.forEach((element) => {
      amendmentTypeArray[element.id] = element.description;
    });
    const query = db
      .select([
        'plan_snapshot.id',
        'plan_snapshot.plan_id',
        'plan_snapshot.version',
        'plan_snapshot.snapshot',
        'plan_snapshot.status_id',
        'plan_snapshot.created_at',
        'user_account.family_name',
        'user_account.given_name',
      ])
      .table('plan_snapshot')
      .leftJoin('user_account', {
        'plan_snapshot.user_id': 'user_account.id',
      })
      .andWhere({
        plan_id: planId,
      })
      .orderBy('plan_snapshot.created_at', 'dsc');
    if (startDate) query.andWhere('plan_snapshot.created_at', '<=', startDate);
    const response = [];
    let lastMandatoryAmendment = null;
    const results = await query;
    for (let index = 0; index < results.length; index++) {
      const row = results[index];
      const nextRow = results[index + 1];
      row.isCurrentLegalVersion = false;
      if (row.status_id === 21) {
        response.push({
          id: row.id,
          version: row.version,
          planId: row.plan_id,
          createdAt: row.created_at,
          submittedBy: `${row.given_name} ${row.family_name}`,
          approvedAt: null,
          approvedBy: null,
          amendmentType: amendmentTypeArray[1],
          snapshot: row.snapshot,
        });
      } else if (row.status_id === 22 || (row.status_id === 23 && nextRow?.status_id !== 21)) {
        lastMandatoryAmendment = response.length;
        response.push({
          id: row.id,
          version: row.version,
          planId: row.plan_id,
          createdAt: row.created_at,
          submittedBy: `${row.given_name} ${row.family_name}`,
          approvedAt: null,
          approvedBy: null,
          amendmentType: amendmentTypeArray[2],
          snapshot: row.snapshot,
        });
      } else if (row.status_id === 12 && row.snapshot.amendmentTypeId === null) {
        response.push({
          id: row.id,
          version: row.version,
          planId: row.plan_id,
          createdAt: null,
          submittedBy: null,
          approvedAt: row.created_at,
          approvedBy: `${row.given_name} ${row.family_name}`,
          amendmentType: null,
          snapshot: row.snapshot,
        });
      }
      if ([20, 8, 9, 12].indexOf(row.status_id) !== -1) {
        if (lastMandatoryAmendment !== null) {
          response[lastMandatoryAmendment].approvedBy = `${row.given_name} ${row.family_name}`;
          response[lastMandatoryAmendment].approvedAt = row.created_at;
          response[lastMandatoryAmendment].version = row.version;
          response[lastMandatoryAmendment].snapshot = row.snapshot;
          lastMandatoryAmendment = null;
        }
      }
    }
    const responseSorted = response.reverse();

    const currentLegalVersion = responseSorted.find(
      (resp) => Plan.legalStatuses.indexOf(resp.snapshot.statusId) !== -1,
    );
    if (currentLegalVersion) currentLegalVersion.isCurrentLegalVersion = true;
    return responseSorted;
  }

  async fetchStatus(db) {
    const status = await PlanStatus.findOne(db, { id: this.statusId });
    if (status) {
      this.status = status;
    }
  }

  static async create(db, values) {
    if (Plan.legalStatuses.indexOf(values.status_id) !== -1) {
      try {
        values.snapshot = JSON.stringify(values.snapshot);
      } catch (error) {
        throw errorWithCode(`Error creating PDF file: ${JSON.stringify(error)}`, 500);
      }
    }
    await super.create(db, values);
  }
}
