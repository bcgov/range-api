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
 * Check if a string consits of [Aa-Az], [0-9], -, _, and %.
 *
 * @param {String} message The error message
 * @param {Number} code    The error code (property)
 * @returns An `Error` object with the message and code set
 */
export const errorWithCode = (message, code) => {
  const error = new Error(message);
  error.code = code;

  return error;
};


/**
 * Convert a stream into a buffer
 *
 * @param {ReadStream} stream The stream containing the data to be converted
 * @returns A resolved `Promise` with the buffer or rejected in the case of failure
 */
export const streamToBuffer = stream => new Promise((resolve, reject) => {
  const buffers = [];
  stream.on('error', reject);
  stream.on('data', data => buffers.push(data));
  stream.on('end', () => resolve(Buffer.concat(buffers)));
});
