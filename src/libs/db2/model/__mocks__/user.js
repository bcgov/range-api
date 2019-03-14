import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

// const passport = jest.requireActual('passport');
export default class User extends Model {
  static find() {
    return fixtures.allUsers;
  }

  static update(db, a1, a2) {
    assert(db);
    assert(a1);
    assert(a2);
    assert(Object.values(a2)[0]);
    if (a1.id === 1) {
      return a2;
    }
    throw Error('Wrong user');
  }
}
