import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures/userclientlink_mock.json';

export default class UserClientLink extends Model {
  static findWithExclusion() {
    return fixtures;
  }

  static create(db, values) {
    try {
      assert(db);
      assert(values);

      if (
        (values.user_id === 1 || values.user_id === '1') &&
        values.client_id
      ) {
        return { ...values, id: 1, clientId: values.client_id };
      }
      throw Error('Wrong user');
    } catch (err) {
      throw Error('Unexpected input or wrong user');
    }
  }

  static async findOne(db, where) {
    assert(db);

    const fixture = this.findWithExclusion();

    if (where.client_id && where.user_id) {
      return fixture.find((link) => link.client_id === where.client_id)
        ? this.transformToCamelCase(
            fixture.find((link) => link.client_id === where.client_id),
          )
        : undefined;
    }

    if (where.client_id) {
      return fixture.find((link) => link.client_id === where.client_id)
        ? this.transformToCamelCase(
            fixture.find((link) => link.client_id === where.client_id),
          )
        : undefined;
    }

    if (where.user_id) {
      return fixture.find((link) => link.user_id === where.user_id)
        ? this.transformToCamelCase(
            fixture.find((link) => link.user_id === where.user_id),
          )
        : undefined;
    }

    return undefined;
  }
}
