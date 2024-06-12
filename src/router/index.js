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

/* Important note on API Versioning:  change the path to the path to route code in the import
   and the version in the endpoint below
   */
import cors from 'cors';
import passport from 'passport';
import agreement from './routes_v1/agreement';
import client from './routes_v1/client';
import district from './routes_v1/district';
import ehlo from './routes_v1/ehlo';
import feedback from './routes_v1/feedback';
import files from './routes_v1/files';
import plan from './routes_v1/plan';
import notification from './routes_v1/notification'
import reference from './routes_v1/reference';
import user from './routes_v1/user';
import roles from './routes_v1/roles';
import version from './routes_v1/version';
import zone from './routes_v1/zone';
import emailTemplate from './routes_v1/emailTemplate';

const corsOptions = {
  // origin: config.get('appUrl'),
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

module.exports = (app) => {
  app.use(cors(corsOptions));
  app.use('/api/v1/ehlo', ehlo); // probes
  app.use('/api/v1/version', version); // app versions
  // authentication middleware for routes.
  app.use(passport.authenticate('jwt', { session: false }));
  app.use('/api/v1/agreement', agreement);
  app.use('/api/v1/client', client);
  app.use('/api/v1/district', district);
  app.use('/api/v1/plan', plan);
  app.use('/api/v1/notification', notification);
  app.use('/api/v1/reference', reference);
  app.use('/api/v1/zone', zone);
  app.use('/api/v1/user', user);
  app.use('/api/v1/roles', roles);
  app.use('/api/v1/feedback', feedback);
  app.use('/api/v1/files', files);
  app.use('/api/v1/emailTemplate', emailTemplate);
};
