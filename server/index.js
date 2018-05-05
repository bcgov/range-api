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

import bodyParser from 'body-parser';
import compression from 'compression';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import express from 'express';
import config from './config';
import auth from './libs/authmware';
import DataManager from './libs/db2';
import { logger, started } from './libs/logger';

const env = config.get('environment');

const dm = new DataManager(config);
const {
  db,
  Agreement,
  District,
  Zone,
} = dm;

const foo = async () => {
  const a = (await Agreement.find(db, { forest_file_id: 'RAN075120' })).pop();
  const z = (await Zone.find(db, { id: a.zoneId })).pop();
  const d = (await District.find(db, { id: z.districtId })).pop();

  const agreement = { ...a, zone: { ...z, district: d } };
  console.log(agreement);

  const ag = (await Agreement.find(db, { forest_file_id: 'RAN075120' })).pop();
  const zones = await Zone.find(db, {});
  const districts = await District.find(db, {});

  ag.zone = zones.find(item => item.id === ag.zoneId);
  ag.zone.district = districts.find(item => item.id === ag.zone.id);

  console.log(ag);
};

foo();

// Middlewares

// Config
const isDev = env !== 'production';
const port = config.get('port');
const app = express();
const options = {
  inflate: true,
  limit: '3000kb',
  type: 'image/*',
};

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.raw(options));
app.use(flash());

// Authentication middleware
app.use(auth(app));

// Server API routes
require('./router')(app);

// Error handleing middleware. This needs to be last in or it will
// not get called.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error(err.message);
  const code = err.code ? err.code : 500;
  const message = err.message ? err.message : 'Internal Server Error';

  res.status(code).json({ error: message, success: false });
});

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    return logger.error(`There was a problem starting the server, ${err.message}`);
  }
  if (isDev) {
    return started(port);
  }
  return logger.info(`Production server running on port: ${port}`);
});

module.exports = app;
