import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class UserClientLink extends Model {
  static findWithExclusion() {
    return fixtures.allUsers;
  }

  static create(db, values) {
    try {
      assert(db);
      assert(values);

      if ((values.user_id === 1 || values.user_id === '1') && values.client_id) {
        return { ...values, id: 1, clientId: values.client_id };
      }
      throw Error('Wrong user');
    } catch (err) {
      throw Error('Unexpected input or wrong user');
    }
  }
}
