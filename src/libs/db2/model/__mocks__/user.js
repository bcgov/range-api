import Model from '../model';

export default class User extends Model {
  static find() {
    return [{ foo: 1 }, { foo: 2 }];
  }
}
