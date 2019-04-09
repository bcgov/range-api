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

import cors from 'cors';
import passport from 'passport';
import { agreement as agreement_v1 } from './routes_v1/agreement';
import { client as client_v1 }  from './routes_v1/client';
import { district as district_v1 } from './routes_v1/district';
import { ehlo as ehlo_v1 } from './routes_v1/ehlo';
import { plan as plan_v1 } from './routes_v1/plan';
import { reference as reference_v1}  from './routes_v1/reference';
import { report as report_v1 } from './routes_v1/report';
import { user as user_v1 } from './routes_v1/user';
import { zone as zone_v1 } from './routes_v1/zone';
import { feedback as feedback_v1 } from './routes_v1/feedback';
import { version as version_v1 } from './routes_v1/version';

const corsOptions = {
  // origin: config.get('appUrl'),
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

module.exports = (app) => {
  app.use(cors(corsOptions));
  app.use('/api/v1/ehlo', ehlo_v1); // probes
  app.use('/api/v1/version', version_v1); // app versions
  // authentication middleware for routes.
  app.use(passport.authenticate('jwt', { session: false }));
  app.use('/api/v1/agreement', agreement_v1);
  app.use('/api/v1/client', client_v1);
  app.use('/api/v1/district', district_v1);
  app.use('/api/v1/plan', plan_v1);
  app.use('/api/v1/reference', reference_v1);
  app.use('/api/v1/zone', zone_v1);
  app.use('/api/v1/report', report_v1);
  app.use('/api/v1/user', user_v1);
  app.use('/api/v1/feedback', feedback_v1);
};
