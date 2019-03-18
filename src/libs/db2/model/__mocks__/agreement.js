import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class Agreement extends Model {
  static async agreementsForClientId(db, clientId) {
    assert(db);
    assert(clientId);
    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }

  static async findWithAllRelations(...args) {
    const [
      db,
      where,
    ] = args;

    assert(db);
    assert(where);

    const results = fixtures.agreements.map((item) => {
      const value = item;
      const empty = () => {};
      value.transformToV1 = empty;
      return value;
    });

    return results;
  }

  static async agreementsForZoneId(db, zoneId) {
    assert(db);
    assert(zoneId);

    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }

  static async searchForTerm(db, term) {
    assert(db);
    assert(term);

    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }

  static async find(db, where) {
    assert(db);
    assert(where);
    assert(Object.keys(where).length > 0);

    const results = fixtures.agreements.map((item) => {
      const value = item;
      const empty = () => {};
      value.transformToV1 = empty;
      return value;
    });

    return results;
  }

  static async count(db) {
    assert(db);

    return 1;
  }

  transformToV1() {
    assert(this);
  }
}
