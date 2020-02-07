import Model from './model';
import User from './user';

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
      'id', 'snapshot', 'plan_id', 'created_at', 'version',
    ].map(f => `${PlanSnapshot.table}.${f}`);
  }

  static get table() {
    return 'plan_snapshot';
  }
}
