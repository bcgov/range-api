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

import { errorWithCode } from '@bcgov/nodejs-common-utils';

/**
 * Check if a string consits of [Aa-Az], [0-9], -, _, and %.
 *
 * @param {String} str The string to be validated
 * @returns true if the string is valid, false otherwise
 */
export const isValid = str => str && /^[0-9A-Za-z\s\-_%]+$/.test(str);

/**
 * Check if a string consits of [0-9].
 *
 * @param {String} str The string to be validated
 * @returns true if the string is a number, false otherwise
 */
export const isNumeric = str => str && /^\d+$/.test(str);

/**
 * Check required fields in the object
 *
 * @param {Array} properties
 * @param {Object} obj
 */
export const checkRequiredFields = (properties = [], name, obj) => {
  const missingFields = [];
  properties.map((p) => {
    if (obj[p] === undefined) {
      missingFields.push(p);
    }
    return undefined;
  });

  const { length } = missingFields;
  if (length !== 0) {
    switch (length) {
      case 1:
      case 2:
        throw errorWithCode(`There are missing fields in ${name}. Required field: (${missingFields.join(' and ')})`);
      default:
        throw errorWithCode(`There are missing fields in ${name}. Required field: (${`${missingFields.slice(0, length - 1).join(', ')}, and ${missingFields[length - 1]}`})`);
    }
  }
  return undefined;
};
