
import assert from 'assert';
import Model from '../model';

export default class Client extends Model {
  static async find(db, where) {
    assert(db);
    assert(where);
    assert(where.client_number);

    return {
      clientId: where.client_number,
    };
  }
}
