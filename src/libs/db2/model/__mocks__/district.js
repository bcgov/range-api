import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class District extends Model {
  static async find() {
    console.log(typeof fixtures.district);
    return (fixtures.districts);
  }
}
