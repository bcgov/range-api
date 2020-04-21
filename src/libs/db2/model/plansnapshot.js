import Model from './model';
import User from './user';
import PlanStatus from './planstatus';

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
      'id', 'snapshot', 'plan_id', 'created_at', 'version', 'status_id','user_id',
    ].map(f => `${PlanSnapshot.table}.${f}`);
  }

  static get table() {
    return 'plan_snapshot';
  }

static async findSummary(db, where, order = undefined) {
    let results = [];
    const q = db
      .table('plan_snapshot_summary')
      .select('*');
    if (Object.keys(where).length === 1 && where[Object.keys(where)[0]].constructor === Array) {
      const k = Object.keys(where)[0];
      const v = where[k];
      q.whereIn(k, v);
    } else {
      q.where(where);
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
}
