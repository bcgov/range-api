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

  async fetchStatus(db) {
    const status = await PlanStatus.findOne(db, { id: this.statusId });

    if (status) {
      this.status = status;
    }
  }
}
