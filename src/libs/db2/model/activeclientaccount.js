import Model from './model';

export default class ActiveClientAccount extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (ActiveClientAccount.fields.indexOf(`${ActiveClientAccount.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id', 'user_id', 'client_id', 'active', 'created_at', 'updated_at',
    ].map(f => `${ActiveClientAccount.table}.${f}`);
  }

  static get table() {
    return 'active_client_account';
  }
}
