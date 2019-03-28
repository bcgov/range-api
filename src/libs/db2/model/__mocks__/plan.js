import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class Client extends Model {
  static async find(db, where) {
    assert(db);
    assert(where);
    assert(where.client_number);

    return fixtures;
  }
}
