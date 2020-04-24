// Copyright © 2019 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
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

import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';

import createApp from '../../src';

jest.mock('../../src/libs/db2/model/user');
jest.mock('request-promise-native');
jest.mock('../../src/libs/db2/model/client');
jest.mock('../../src/libs/db2/model/userclientlink');

describe('Test user routes happy path', () => {
  afterAll(() => {
    // connection.destroy();
  });

  // Test all user routes
  test('All user route with 200 and resp length > 0', async (done) => {
    const app = await createApp();
    await request(app)
      .get('/api/v1/user')
      .expect(200).expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.length).toBeGreaterThan(0);
        const usr = results[0];
        expect(usr.id).toBeDefined();
        expect(usr.username).toBeDefined();
        expect(usr.givenName).toBeDefined();
        expect(usr.familyName).toBeDefined();
        expect(usr.email).toBeDefined();
        expect(usr.active).toBeDefined();
        expect(usr.piaSeen).toBeDefined();
        done();
      });
  });

  // Test /me route get
  test('should return user with id 1', async (done) => {
    const app = await createApp();
    await request(app)
      .get('/api/v1/user/me')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.id).toEqual(1);
        done();
      });
  });

  // Test /me route put
  test('should update user', async (done) => {
    const app = await createApp();

    const update = {
      givenName: 'lao',
      familyName: 'Ballabh',
      phoneNumber: '+1 250-567-6576',
    };
    await request(app)
      .put('/api/v1/user/me')
      .send(update)
      .set('Accept', 'application/json')
      .expect(200)
      .expect((res) => {
        const usr = res.body;
        expect(typeof usr).toBe('object');
        expect(usr.givenName).toEqual(update.givenName);
        expect(usr.familyName).toEqual(update.familyName);
        expect(usr.phoneNumber).toEqual(update.phoneNumber);
        done();
      });
  });

  test('Creating a user client link', async (done) => {
    const app = await createApp();
  
    const clientId = 1;

    await request(app)
      .post('/api/v1/user/1/client')
      .send({ clientId })
      .expect(200)
      .expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.id).toEqual(1);
        expect(result.clientId).toEqual(clientId);
        done();
      });
  });

  test('Creating an already existing link should return 400', async () => {
    const app = await createApp();
    
    const clientId = 3;

    await request(app)
      .post('/api/v1/user/1/client')
      .send({ clientId })
      .expect(400);
  });

  // TODO: Test deleting client links
});

describe('Test user routes failure', () => {
  beforeAll(() => {
  });

  beforeEach(() => {
    passport.aUser.isAgreementHolder = () => false;
  });

  test('AgreementHolder should return 403', async (done) => {
    const app = await createApp();

    passport.aUser.isAgreementHolder = () => true;
    try {
      await request(app).get('/api/v1/user').expect(403);
      done();
    } catch (e) {
      // expect(e.status).toBe(403);
      // done();
    }
  });

  // Test /me route
  test('should fail update user', async (done) => {
    const app = await createApp();
    // const update = {};
    await request(app)
      .put('/api/v1/user/me')
      .send('lao')
      .set('Accept', 'application/json')
      .expect(500)
      .expect((res) => {
        const error = res.body;
        expect(typeof error).toBe('object');
        expect(error.success).toEqual(false);
        done();
      });
    done();
  });

  // Update client id fail case: no client id in param
  test('Creating a client link should fail if no client ID is provided', async (done) => {
    const app = await createApp();
    await request(app)
      .post('/api/v1/user/1/client/')
      .expect(500);
    done();
  });

  // Update client id fail case: no id in param
  test('Creating a client link should fail if no user ID is provided', async (done) => {
    const app = await createApp();
    await request(app)
      .post('/api/v1/user/client/')
      .send({ clientId: 1 })
      .expect(500);
    done();
  });
});
