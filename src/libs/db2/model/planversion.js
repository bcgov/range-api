import Model from './model';
import User from './user';

export default class PlanVersion extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (PlanVersion.fields.indexOf(`${PlanVersion.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.creator = new User(User.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['canonical_id', 'version', 'plan_id', 'created_at', 'updated_at'].map((f) => `${PlanVersion.table}.${f}`);
  }

  static get table() {
    return 'plan_version';
  }
}
