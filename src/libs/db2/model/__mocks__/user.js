import Model from '../model';
import { SSO_ROLE_MAP } from '../../../../constants';

export default class User extends Model {
  static find() {
    return [{ foo: 1 }, { foo: 2 }];
  }
}
