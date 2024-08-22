'use strict';

import Model from './model';
import User from './user';

export default class UserFeedback extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (UserFeedback.fields.indexOf(`${UserFeedback.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.user = data.user_id ? new User(User.extract(data)) : null;
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'user_id', 'feedback', 'section'].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'user_feedback';
  }

  static async findWithUser(db, where) {
    const myFields = [...UserFeedback.fields, ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`)];

    const results = await db
      .select(myFields)
      .from(UserFeedback.table)
      .leftJoin('user_account', {
        'user_feedback.user_id': 'user_account.id',
      })
      .where(where);

    return results.map((row) => new UserFeedback(row, db));
  }
}
