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
// Created by Pushan Mitra on 2019-03-15.
//
import request from 'supertest';
import passport from 'passport';

import app from '../../src';

jest.mock('../../src/libs/db2/model/agreement');
jest.mock('../../src/libs/db2/model/client');
jest.mock('../../src/libs/db2/model/zone');
jest.mock('request-promise-native');

describe('Test agreement route', () => {
  test('should fetch all agreements for agreement holder for user', async (done) => {
    passport.aUser.isAgreementHolder = () => true;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement')
      .expect(200).expect((res) => {
        const result = res.body[0];
        expect(typeof result).toBe('object');
        expect(result.forestFileId).toEqual('RAN076843');
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should fetch all agreements for rage officer for user', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => true;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement')
      .expect(200).expect((res) => {
        const result = res.body[0];
        expect(typeof result).toBe('object');
        expect(result.forestFileId).toEqual('RAN076843');
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should fail for admin', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement')
      .expect(401).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.error).toEqual('This endpoint is forbidden for the admin user');
        expect(result.success).toEqual(false);
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });


  test('should fail for unknown user', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement')
      .expect(500).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.error).toEqual('Unable to determine user roll');
        expect(result.success).toEqual(false);
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });
});

describe('Test agreement route search', () => {
  test('should search for agreement holder', async (done) => {
    passport.aUser.isAgreementHolder = () => true;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?term=965&page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        // console.dir(result);
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should search for range officer', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => true;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?term=965&page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should search for admin', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?term=965&page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });
});

describe('Test agreement route search without term', () => {
  test('should search(without term) for agreement holder', async (done) => {
    passport.aUser.isAgreementHolder = () => true;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        // console.dir(result);
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should search(without term) for range officer', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => true;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });

  test('should search(without term)) for admin', async (done) => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/agreement/search?page=1&limit=10')
      .expect(200).expect((res) => {
        const result = res.body;
        expect(typeof result).toBe('object');
        expect(result.perPage).toEqual(10);
        expect(result.totalItems).toBeTruthy();
        expect(result.totalPages).toBeTruthy();
        expect(result.agreements).toBeTruthy();
        delete passport.aUser.isRangeOfficer;
        delete passport.aUser.isAdministrator;
        delete passport.aUser.clientId;
        passport.aUser.isAgreementHolder = () => false;
        done();
      });
  });
});
