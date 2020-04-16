import assert from 'assert';
import Model from '../model';
import clientAgreementMock from '../../../../../__mocks__/fixtures/client_agreement_mock.json';

export default class ClientAgreement extends Model {
  static loadFixture() {
    return clientAgreementMock.map(this.transformToCamelCase);
  }

  static async find(db, where) {
    assert(db);
    assert(where);
    assert(Object.keys(where).length > 0);

    return ClientAgreement.loadFixture();
  }
}
