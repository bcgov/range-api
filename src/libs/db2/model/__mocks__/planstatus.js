import assert from 'assert';
import Model from '../model';
// import fixtures from '../../../../../__mocks__/fixtures';

export default class PlanStatus extends Model {
  static async find(db, where) {
    assert(db, 'PlanStatus: require: db');
    assert(where, 'PlanStatus: require: where');

    return {
      id: 1,
      find: () => ({ id: 1, bla: 'bla' }),
    };
  }
}
