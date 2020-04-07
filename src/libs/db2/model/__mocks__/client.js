
import assert from 'assert';
import Model from '../model';

export default class Client extends Model {
  static async find(db, where) {
    assert(db);
    assert(where);
    assert(where.id);

    return {
      clientId: where.id,
    };
  }

  static async findOne(db, where) {
    assert(db);
    assert(where);
    assert(where.id);

    return {
      clientId: where.id,
    };
  }

  static async searchForTerm(db, term) {
    assert(db);
    assert(term);

    return ['67896675', '67896676', '67896677'];
  }
}
