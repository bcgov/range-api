import { errorWithCode } from '../../../libs/bcgov-shim.js';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import User from './user.js';
import PlanStatus from './planstatus.js';
import Plan from './plan.js';
import AmendmentType from './amendmenttype.js';

export default class PlanSnapshot extends KyselyModel {
  declare creator: User;
  declare statusId: number;
  declare status: any;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.creator = new User(User.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'snapshot', 'plan_id', 'created_at', 'version', 'status_id', 'user_id', 'is_discarded', 'pdf_file'];
  }

  static get table(): string {
    return 'plan_snapshot';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async create(_db: any, values: Record<string, any>) {
    const db = _db || kyselyDb;
    if (Plan.legalStatuses.indexOf(values.status_id) !== -1) {
      try {
        values.snapshot = JSON.stringify(values.snapshot);
      } catch (error: any) {
        throw errorWithCode(`Error creating PDF file: ${JSON.stringify(error)}`, 500);
      }
    }
    const obj: Record<string, any> = {};
    PlanSnapshot.fields.forEach((key) => {
      if (values[PlanSnapshot.toCamelCase(key)] !== undefined) obj[key] = values[PlanSnapshot.toCamelCase(key)];
      else if (values[key] !== undefined) obj[key] = values[key];
    });
    const results: any = await db.insertInto('plan_snapshot').values(obj).returning('id').execute();
    const newId = typeof results[0] === 'number' ? results[0] : results[0].id;
    return PlanSnapshot.findById(_db, newId);
  }

  static async findSummary(_db: any, where: Record<string, any>, whereNotNull?: string, order?: [string, string]) {
    const db = _db || kyselyDb;
    let query: any = db.selectFrom('plan_snapshot_summary').selectAll();
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    if (whereNotNull) {
      query = query.where(whereNotNull, 'is not', null);
    }
    if (order && order.length > 0) {
      query = query.orderBy(order[0], order[1] || 'asc');
    }
    const results = await query.execute();
    const objs = results.map((row: any) => {
      const obj: any = Object.create(PlanSnapshot.prototype, {
        db: { enumerable: false, value: db, writable: false },
      });
      Object.assign(obj, PlanSnapshot.transformToCamelCase(row));
      return obj;
    });
    return objs;
  }

  static async fetchAmendmentSubmissions(_db: any, planId: number, startDate?: Date) {
    const db = _db || kyselyDb;
    const amendmentTypeRows = await AmendmentType.find(db, {});
    const amendmentTypeArray: any[] = [];
    amendmentTypeRows.forEach((element: any) => {
      amendmentTypeArray[element.id] = element.description;
    });
    let query: any = db
      .selectFrom('plan_snapshot')
      .leftJoin('user_account', 'plan_snapshot.user_id', 'user_account.id')
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
      .where('plan_snapshot.plan_id', '=', planId)
      .orderBy('plan_snapshot.created_at', 'desc');
    if (startDate) query = query.where('plan_snapshot.created_at', '<=', startDate);
    const results = await query.execute();
    const response: any[] = [];
    let lastMandatoryAmendment: number | null = null;
    let lastMinorAmendment: number | null = null;
    for (let index = 0; index < results.length; index++) {
      const row: any = results[index];
      const nextRow: any = results[index + 1];
      row.isCurrentLegalVersion = false;
      if (row.snapshot?.amendmentTypeId === 4) {
        response.push({
          id: row.id,
          version: row.version,
          planId: row.plan_id,
          createdAt: null,
          submittedBy: null,
          approvedAt: row.created_at,
          approvedBy: `${row.given_name} ${row.family_name}`,
          amendmentType: amendmentTypeArray[4],
          snapshot: row.snapshot,
        });
      }
      if (row.status_id === 21) {
        lastMinorAmendment = response.length;
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
      if ([7, 8, 9].indexOf(row.status_id) !== -1) {
        if (lastMinorAmendment !== null) {
          response[lastMinorAmendment].approvedBy = `${row.given_name} ${row.family_name}`;
          response[lastMinorAmendment].approvedAt = row.created_at;
          response[lastMinorAmendment].version = row.version;
          response[lastMinorAmendment].snapshot = row.snapshot;
          lastMinorAmendment = null;
        }
      }
    }
    const responseSorted = response.reverse();
    const currentLegalVersion = responseSorted.find(
      (resp: any) => Plan.legalStatuses.indexOf(resp.snapshot.statusId) !== -1,
    );
    if (currentLegalVersion) currentLegalVersion.isCurrentLegalVersion = true;
    return responseSorted;
  }

  async fetchStatus(_db: any) {
    const db = _db || kyselyDb;
    const status = await PlanStatus.findOne(db, { id: this.statusId });
    if (status) {
      this.status = status;
    }
  }
}
