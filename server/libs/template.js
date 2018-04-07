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
// Created by Jason Leach on 2018-01-18.
//

/* eslint-env es6 */

'use strict';

import path from 'path';
import fs from 'fs';
import handlebars from 'handlebars';
import wkhtmltopdf from 'wkhtmltopdf';
import { logger } from './logger';

if (process.platform === 'linux') {
  // On Linux (OpenShift) we need to run our own copy of the binary with any related
  // libs.
  const lpath = path.join(__dirname, '../../', 'wkhtmltopdf-amd64-0.12.4', 'lib');
  const bpath = path.join(__dirname, '../../', 'wkhtmltopdf-amd64-0.12.4', 'bin', 'wkhtmltopdf');
  wkhtmltopdf.command = `${process.env.LD_LIBRARY_PATH}:${lpath} ${bpath}`;
}

/**
 * Compile the handelbars template and run it with the given context
 * to produce html.
 *
 * @param {ReadStream} source A stream asociated to the handelbars markup template
 * @param {JSON} context The object with appropriate data for the template
 * @returns A resolved `Promise` with the HTML data.
 */
export const compile = (source, context) => {
  const html = handlebars.compile(source.toString('utf-8'))(context);
  return Promise.resolve(html);
};

/**
 * Render the given HTML as a PDF document and return a stream of the newly generated PDF.
 *
 * @param {String} html A string containing HTML
 * @returns A resolved `Promise` with the `ReadStream` of the renderd PDF; rejected otherwise.
 */
export const renderToPDF = html =>
  new Promise((resolve, reject) => {
    const fileName = Math.random()
      .toString(36)
      .slice(2);
    const output = path.join('/tmp', fileName);
    const writeStream = fs.createWriteStream(output);
    const options = {
      pageSize: 'letter',
      printMediaType: true,
    };

    wkhtmltopdf(html, options, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      stream.pipe(writeStream).on('finish', () => {
        resolve(fs.createReadStream(output));
      });
    });
  });

/**
 * Load the html template from the local file system and return it as a Buffer.
 *
 * @param {any} fileName The path and name of the file to be loaded
 * @returns A resolved `Promise` with a stream of the loaded file; rejected otherwise.
 */
export const loadTemplate = (fileName) => {
  const docpath = path.join(__dirname, '../../', 'templates', fileName);

  return new Promise((resolve, reject) => {
    fs.access(docpath, fs.constants.R_OK, (accessErr) => {
      if (accessErr) {
        logger.warn('Unable to find templates');
        reject(accessErr);
      }

      fs.readFile(docpath, (readFileErr, data) => {
        if (readFileErr) {
          logger.warn('Unable to load template');
          reject(readFileErr);
        }

        resolve(data);
      });
    });
  });
};
