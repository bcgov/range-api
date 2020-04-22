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

import { logger } from '@bcgov/nodejs-common-utils';
import bodyParser from 'body-parser';
import compression from 'compression';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import express from 'express';
import initPassport from './libs/authmware';
import initRouter from './router';

/**
 * @returns {Express.Application} express app
 */
async function createServer() {
  const app = express();
  const options = {
    inflate: true,
    limit: '3000kb',
    type: 'image/*',
  };

  app.use(compression());
  app.use(cookieParser());
  app.use(
    bodyParser.urlencoded({
      extended: true,
    }),
  );
  app.use(bodyParser.json());
  app.use(bodyParser.raw(options));
  app.use(flash());

  // Initialize passport config
  await initPassport(app);

  // Server API routes
  initRouter(app);

  // Error handling middleware. This needs to be last in or it will
  // not get called.
  app.use((err, req, res) => {
    // eslint-disable-line no-unused-vars
    logger.error(err.message);
    let code = 500;
    // Checking code is valid http status or not
    if (typeof err.code === 'number' && err.code >= 100 && err.code <= 511) {
      ({ code } = err);
    }

    // Getting message from error.
    const message = err.message ? err.message : 'Internal Server Error';

    // Sending error status.
    res.status(code).json({ error: message, success: false });

    if (!['test', 'unit_test'].includes(process.env.NODE_ENV)) {
      throw err;
    }
  });

  return app;
}

export default createServer;
