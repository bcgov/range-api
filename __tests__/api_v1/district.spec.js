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
// Created by Mike Wells on 2019-03-20.

import passport from 'passport';
import request from 'supertest';
import createApp from '../../src';

jest.mock('../../src/libs/db2/model/district');
jest.mock('request-promise-native');
describe('Test district route', () => {
  test('should fetch all districts', async (done) => {
    const app = await createApp();
    await request(app)
      .get('/api/v1/district')
      .expect(200)
      .expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        done();
      });
  });

  test('should fail to fetch all districts', async (done) => {
    const app = await createApp();

    passport.aUser.failDistrict = true;
    await request(app)
      .get('/api/v1/district')
      .expect(500)
      .expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        delete passport.aUser.failDistrict;
        done();
      });
  });
});
