// @ts-nocheck
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

import { errorWithCode } from './bcgov-shim.js';

const camelCase = (str) => str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export const snakeCase = (str) =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/**
 * Check if a string consits of [0-9].
 *
 * @param {String} str The string to be validated
 * @returns true if the string is a number, false otherwise
 */
export const isNumeric = (str) => str && /^\d+$/.test(str);

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
        throw errorWithCode(
          `There are missing fields in the ${name}. ` + `Required field(s): ${missingFields.join(' and ')}`,
        );
      default:
        throw errorWithCode(
          `There are missing fields in the ${name}. ` +
            `Required field(s): ${
              `${missingFields.slice(0, length - 1).join(', ')}, ` + `and ${missingFields[length - 1]}`
            }`,
        );
    }
  }
  return undefined;
};

export const objPathToCamelCase = (path) =>
  path
    .split('.')
    .map((w) => camelCase(w))
    .join('.');

export const objPathToSnakeCase = (path) =>
  path
    .split('.')
    .map((w) => snakeCase(w))
    .join('.');

export const substituteFields = (str, fields) => {
  for (const key of Object.keys(fields)) {
    str = str.replace(new RegExp(key, 'g'), fields[key]);
  }
  return str;
};

export const removeCommonFields = (row) => {
  delete row.id;
  delete row.createdAt;
  delete row.updatedAt;
  delete row.canonicalId;
};
