import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

// const passport = jest.requireActual('passport');
export default class User extends Model {
  static find() {
    return fixtures.allUsers;
  }

  static update(db, a1, a2) {
    try {
      assert(db);
      assert(a1);
      assert(a2);
      assert(Object.values(a2)[0], 'Unexpected input object');
      if (a1.id === 1 || a1.id === '1') {
        if (a2.client_id) {
          const newObj = {};
          newObj.clientId = a2.client_id;
          newObj.active = a2.active;
          newObj.id = a1.id;
          return newObj;
        }
        return a2;
      }
      throw Error('Wrong user');
    } catch (err) {
      throw Error('Unexpected input or wrong user');
    }
  }
}
