import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';
import passport from '../../../../../__mocks__/passport';

export default class District extends Model {
  static async find() {
    if (passport.aUser.failDistrict) {
      throw Error('District:fail');
    }
    return fixtures.districts;
  }
}
