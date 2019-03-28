import assert from 'assert';
import Model from '../model';
import fixtures from '../../../../../__mocks__/fixtures';

export default class Agreement extends Model {
  static async agreementsForClientId(db, clientId) {
    assert(db, 'agreement:agreementsForClientId: No data base');
    assert(clientId, 'agreement:agreementsForClientId: No client id');
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
    assert(db, 'agreement:agreementsForZoneId: No data base');
    assert(zoneId, 'agreement:agreementsForZoneId: No zone id');

    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }

  static async searchForTerm(db, term) {
    assert(db, 'agreement:searchForTerm: No data base');
    assert(term, 'agreement:searchForTerm: No term');

    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }

  static async find(db, where) {
    assert(db, 'agreement:find: No data base');
    assert(where, 'agreement:find: No where');
    assert(Object.keys(where).length > 0);
    if (where.forest_file_id === 'RAN999999') {
      return [];
    }

    const results = fixtures.agreements.map((item) => {
      const value = item;
      const empty = () => {};
      value.transformToV1 = empty;
      return value;
    });

    return results;
  }

  static async count(db) {
    assert(db, 'agreement:count: No db');

    return 1;
  }

  static async findWithTypeZoneDistrictExemption(db, where) {
    assert(db, 'agreement: require: db');
    assert(where, 'agreement: require where');
  }

  static async update(db, where, updateObj) {
    assert(db, 'agreement:update: No data base');
    assert(where, 'agreement:update: No where');
    assert(Object.keys(where).length > 0, 'agreement:update: empty where');
    assert(updateObj, 'agreement:update: No update obj');
    assert(Object.keys(updateObj).length > 0, 'agreement:update: empty update obj');

    return ['RAN076843', 'RAN076844', 'RAN076845'];
  }


  transformToV1() {
    assert(this);
  }
}
