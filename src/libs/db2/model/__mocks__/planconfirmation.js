import assert from 'assert';
import Model from '../model';
// import fixtures from '../../../../../__mocks__/fixtures';

export default class PlanConfirmation extends Model {
  static async refreshConfirmations(db, planInd, user) {
    assert(db);
    assert(planInd);
    assert(user);

    return {
      id: 1,
    };
  }
}
