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
import _ from 'lodash';

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
 * @param {Array} fields
 * @param {Object} req
 */
export const checkRequiredFields = (fields = [], prop, req) => {
  const missingFields = [];
  const obj = req[prop];

  fields.map((f) => {
    if (obj[f] === undefined) {
      missingFields.push(f);
    }
    return undefined;
  });

  const { length } = missingFields;
  const name = prop === 'params' ? 'path' : 'body';

  if (length !== 0) {
    switch (length) {
      case 1:
      case 2:
        throw errorWithCode(`There are missing fields in the ${name}. `
          + `Required field(s): ${missingFields.join(' and ')}`);
      default:
        throw errorWithCode(`There are missing fields in the ${name}. `
          + `Required field(s): ${`${missingFields.slice(0, length - 1).join(', ')}, `
          + `and ${missingFields[length - 1]}`}`);
    }
  }
  return undefined;
};

export const deepMapKeys = (originalObject, callback) => {
  if (typeof originalObject !== 'object' || originalObject === null || originalObject instanceof Date) {
    return originalObject;
  }

  return Object.keys(originalObject || {}).reduce((newObject, key) => {
    const newKey = callback(key);
    const originalValue = originalObject[key];
    let newValue = originalValue;
    if (Array.isArray(originalValue)) {
      newValue = originalValue.map(item => deepMapKeys(item, callback));
    } else if (typeof originalValue === 'object') {
      newValue = deepMapKeys(originalValue, callback);
    }
    return {
      ...newObject,
      [newKey]: newValue,
    };
  }, {});
};

export const objPathToCamelCase = path =>
  _.join(
    _.map(
      _.split(path, '.'),
      w => _.camelCase(w),
    ),
    '.',
  );

export const objPathToSnakeCase = path =>
  _.join(
    _.map(
      _.split(path, '.'),
      w => _.snakeCase(w),
    ),
    '.',
  );
