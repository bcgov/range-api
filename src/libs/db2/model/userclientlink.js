import Model from './model';

export default class UserClientLink extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (UserClientLink.fields.indexOf(`${UserClientLink.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'user_id', 'client_id', 'active', 'created_at', 'updated_at'].map(
      (f) => `${UserClientLink.table}.${f}`,
    );
  }

  static get table() {
    return 'user_client_link';
  }
}
