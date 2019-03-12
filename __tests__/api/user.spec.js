// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Pushan Mitra on 2019-03-07.
//
// import assert from 'assert';
import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';

import app from '../../src';

jest.mock('../../src/libs/db2/model/user');
jest.mock('request-promise-native');


describe('Test user routes happy path', () => {
  afterAll(() => {
    // connection.destroy();
  });

  test('All user route with 200 and resp length > 0', async (done) => {
    await request(app)
      .get('/api/v1/user')
      .expect(200).expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.length).toBeGreaterThan(0);
        done();
      });
  });
});

describe('Test user routes failure', () => {
  beforeAll(() => {
  });

  beforeEach(() => {
    passport.aUser.isAgreementHolder = () => false;
  });

  test('AgreementHolder should return 403', async (done) => {
    passport.aUser.isAgreementHolder = () => true;
    await request(app)
      .get('/api/v1/user')
      .expect(403).expect((res) => {
        const results = res.body;
        expect(results.status).toBe(false);
      });
    done();
  });
});
