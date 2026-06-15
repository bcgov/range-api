//
// SecureImage
//
// Copyright © 2018 Province of British Columbia
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
// Created by Jason Leach on 2018-01-10.
//

'use strict';

import { isNumeric, isValid, snakeCase, objPathToSnakeCase, objPathToCamelCase } from '../src/libs/utils';

describe('utility helpers', () => {
  beforeEach(() => {
    // nothig to do
  });

  afterEach(() => {
    // nothig to do
  });

  test('isValid handles a valid string', async () => {
    const testString = 'a-b_c%123';

    expect(isValid(testString)).toBe(true);
  });

  test('isValid handles string with invalid characters', async () => {
    const testString = 'a-b_c#123';

    expect(isValid(testString)).toBe(false);
  });

  test('isNumeric corectly deals with strings', async () => {
    const notAnumber = 'A';
    const isAnumber = '1';

    expect(isNumeric(notAnumber)).toBe(false);
    expect(isNumeric(isAnumber)).toBe(true);
  });

  test('snakeCase converts pldAUMs to pld_aums', async () => {
    expect(snakeCase('pldAUMs')).toBe('pld_aums');
  });

  test('snakeCase converts crownAUMs to crown_aums', async () => {
    expect(snakeCase('crownAUMs')).toBe('crown_aums');
  });

  test('snakeCase converts standard camelCase correctly', async () => {
    expect(snakeCase('pastureName')).toBe('pasture_name');
    expect(snakeCase('livestockCount')).toBe('livestock_count');
    expect(snakeCase('dateIn')).toBe('date_in');
    expect(snakeCase('dateOut')).toBe('date_out');
    expect(snakeCase('graceDays')).toBe('grace_days');
  });

  test('snakeCase handles string with no uppercase', async () => {
    expect(snakeCase('already_snake')).toBe('already_snake');
    expect(snakeCase('simple')).toBe('simple');
  });

  test('snakeCase handles livestockTypeName', async () => {
    expect(snakeCase('livestockTypeName')).toBe('livestock_type_name');
  });

  test('objPathToSnakeCase converts dotted paths', async () => {
    expect(objPathToSnakeCase('ref_livestock.name')).toBe('ref_livestock.name');
    expect(objPathToSnakeCase('pldAUMs')).toBe('pld_aums');
    expect(objPathToSnakeCase('crownAUMs')).toBe('crown_aums');
  });

  test('objPathToCamelCase converts snake paths to camelCase', async () => {
    expect(objPathToCamelCase('pasture_name')).toBe('pastureName');
    expect(objPathToCamelCase('livestock_type_name')).toBe('livestockTypeName');
  });
});
