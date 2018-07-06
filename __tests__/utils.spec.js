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

/* eslint-env es6 */

'use strict';

import { isNumeric, isValid } from '../server/libs/utils';

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

  test.skip('streamToBuffer converts a stream into a buffer', async () => {
    // TODO
  });
});
