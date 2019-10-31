import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class Plan extends Model {
  static loadFixtures() {
    const { plan } = fixtures;
    const asyncEmpty = async () => {};
    plan.eagerloadAllOneToMany = asyncEmpty;
    return [plan];
  }

  static async update(db, where, body) {
    assert(db, 'Plan: update: require: db');
    assert(where, 'Plan: update: require: where');
    assert(body, 'Plan: update: require: body');

    return Plan.loadFixtures;
  }

  static async findWithStatusExtension(db, where) {
    assert(db);
    assert(where);
    if (where['plan.id'] === '2') {
      return null;
    }
    return Plan.loadFixtures();
  }

  static async agreementForPlanId(db, planId) {
    assert(db, 'Plan: update: require: db');
    assert(planId, 'Plan: update: require: db');

    return 'RAN076843';
  }

  static async find(db, where) {
    assert(db, 'Plan: find: require: db');
    assert(where, 'Plan: find: require: where');
    assert(where.client_number);

    return Plan.loadFixtures();
  }

  static async findOne(db, where) {
    assert(db, 'Plan: find: require: db');
    assert(where, 'Plan: find: require: where');
    return Plan.loadFixtures();
  }

  static async findCurrentVersion(db, canonicalId) {
    assert(db, 'Plan: findCurrentVersion: require: db');
    assert(canonicalId, 'Plan: findCurrentVersion: require: canonicalId');

    return Plan.loadFixtures()[0];
  }
}
