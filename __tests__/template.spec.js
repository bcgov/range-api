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
// Created by Jason Leach on 2018-02-01.
//

'use strict';

import {
  capitalizeFirstLetter,
  primaryContactFullName,
} from '../server/libs/template';

const contacts = [
  {
    id: '00046524',
    name: 'PHILLIP, DWANE WANE',
    locationCode: '00',
    startDate: new Date(),
    clientAgreement: {
      clientTypeId: 2,
    },
  },
  {
    id: '00046075',
    name: 'PHILLIP, JOSEPH ',
    locationCode: '02',
    startDate: new Date(),
    clientAgreement: {
      clientTypeId: 1,
    },
  },
  {
    id: '00045748',
    name: ' PHILLIP, CLIFFORD JOE',
    locationCode: '00',
    startDate: new Date(),
    clientAgreement: {
      clientTypeId: 2,
    },
  },
];

describe('template functions', () => {
  beforeEach(() => {
    // nothig to do
  });

  afterEach(() => {
    // nothig to do
  });

  test('capitalizeFirstLetter() only effects the first letter of a string', async () => {
    const string = 'hello';
    expect(capitalizeFirstLetter(string).charAt(0) === string.charAt(0).toUpperCase()).toBe(true);
    expect(capitalizeFirstLetter(string).split(1) === string.split(1));
  });

  test('primaryContactFullNameHelper() foo bar', async () => {
    expect(primaryContactFullName(contacts) === 'Joseph Phillip').toBe(true);
  });

  test.skip('loadTemplate() loads a template from the file system', async () => {
    // TODO
  });

  test.skip('compile() returns a properly formated HTML document', async () => {
    // TODO
  });

  test.skip('renderToPDF() returns a stream of a PDF document', async () => {
    // TODO
  });
});
