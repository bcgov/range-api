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
// Created by Jason Leach on 2019-03-01.
//

import { default as request } from 'supertest'; // eslint-disable-line
import app from '../../src';

jest.mock('../../src/libs/db2/model/zone');
jest.mock('request-promise-native');

describe('Test zone routes', () => {
  test('Fetching all zones for a specific district should succeed ', async () => {
    await request(app)
      .get('/api/v1/zone')
      .query({ districtId: 'FOO' })
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.length).toBeGreaterThan(0);
      });
  });

  test('Fetching all zones should succeed', async () => {
    await request(app)
      .get('/api/v1/zone')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.length).toBeGreaterThan(0);
      });
  });
});
