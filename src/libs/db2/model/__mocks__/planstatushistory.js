import assert from 'assert';
import Model from '../model';
// import fixtures from '../../../../../__mocks__/fixtures';

export default class PlanStatusHistory extends Model {
  static async create(db, data) {
    assert(db, 'PlanStatus: require: db');
    assert(data, 'PlanStatus: require: data');
    return data;
  }
}
