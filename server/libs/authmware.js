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
// Created by Jason Leach on 2018-02-14.
//

/* eslint-env es6 */

'use strict';

import { logger, errorWithCode } from '@bcgov/nodejs-common-utils';
import express from 'express';
import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import request from 'request';
import pemFromModAndExponent from 'rsa-pem-from-mod-exp';
import config from '../config';
import DataManager from './db2';

const getJwtSecret = () => new Promise((resolve, reject) => {
  request.get(config.get('sso:certsUrl'), {}, (err, res, certsBody) => {
    if (err) {
      reject(err);
      return;
    }
    const certsJson = JSON.parse(certsBody).keys[0];
    const modulus = certsJson.n;
    const exponent = certsJson.e;
    const algorithm = certsJson.alg;
    if (!modulus) {
      reject(new Error('No modulus'));
      return;
    }
    if (!exponent) {
      reject(new Error('No exponent'));
      return;
    }
    if (!algorithm) {
      reject(new Error('No algorithm'));
      return;
    }
    // build a certificate
    const pem = pemFromModAndExponent(modulus, exponent);
    resolve(pem);
  });
});

const dm = new DataManager(config);
const {
  db,
  User,
} = dm;

const authmware = async (app) => {
  // const sessionOptions = {
  //   secret: config.get('session:key'),
  //   cookie: {
  //     maxAge: config.get('session:maxAge'),
  //     httpOnly: false,
  //   },
  //   resave: false,
  //   saveUninitialized: false,
  // };

  // app.use(session(sessionOptions));
  app.use(passport.initialize());
  app.use(passport.session());

  // We don't store any user information.
  passport.serializeUser((user, done) => {
    logger.info('serialize');
    done(null, {});
  });

  // We don't load any addtional user information.
  passport.deserializeUser((id, done) => {
    logger.info('deserial');
    done(null, {});
  });

  // // We don't use the credentials for anything, just the isAuthenticated() in
  // // the session object to confifm authentication.

  // const oAuth2Strategy = new OAuth2Strategy(
  //   {
  //     authorizationURL: config.get('sso:authUrl'),
  //     tokenURL: config.get('sso:tokenUrl'),
  //     clientID: config.get('sso:clientId'),
  //     clientSecret: config.get('sso:clientSecret'),
  //     callbackURL: url.resolve(`${config.get('appUrl')}`, config.get('sso:callback')),
  //   },
  //   (accessToken, refreshToken, profile, done) => done(null, {}),
  // );

  // // eslint-disable-next-line arrow-body-style
  // oAuth2Strategy.authorizationParams = () => {
  //   // eslint-disable-next-line camelcase
  //   return { kc_idp_hint: 'idir' };
  // };

  // passport.use(oAuth2Strategy);

  const opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  opts.algorithms = ['RS256'];
  opts.secretOrKey = await getJwtSecret();

  opts.passReqToCallback = true;
  // For development purposes only ignore the expiration
  // time of tokens.
  if (config.get('environment') === 'development') {
    opts.ignoreExpiration = true;
  }

  const jwtStrategy = new JwtStrategy(opts, async (req, jwtPayload, done) => {
    try {
      let user = await User.findOne(db, {
        username: jwtPayload.preferred_username,
      });

      if (!user) {
        user = await User.create(db, {
          username: jwtPayload.preferred_username,
          email: jwtPayload.email,
          // givenName: jwtPayload.given_name,
          // familyName: jwtPayload.family_name,
        });
      }

      // User roles are assigned in SSO and extracted from the JWT.
      // See the User object for additional functionality.
      const clientAccess = jwtPayload.resource_access[config.get('sso:clientId')];
      if (clientAccess && clientAccess.roles) {
        user.roles = clientAccess.roles;
      } else {
        return done(errorWithCode('This account has not been assigned a role, please contact the administrator(MyRangeBC@gov.bc.ca).', 403), false); // Forbidden
      }

      if (!user.isActive()) {
        return done(errorWithCode('This account is not active yet. Please contact the administrator(MyRangeBC@gov.bc.ca).', 403), false); // Forbidden
      }

      // Update the last-login time of this user.
      await User.update(db, {
        username: jwtPayload.preferred_username,
      }, {
        lastLoginAt: new Date(),
      });

      return done(null, user); // OK
    } catch (error) {
      logger.error(`error authenticating user ${error.message}`);
      return done(errorWithCode(error.message, 500), false); // Internal Server Error
    }
  });

  passport.use(jwtStrategy);
};

module.exports = () => {
  const app = express();
  authmware(app);

  return app;
};
