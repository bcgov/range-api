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

// import url from 'url';
import express from 'express';
import passport from 'passport';
import request from 'request';
import pemFromModAndExponent from 'rsa-pem-from-mod-exp';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import config from '../config';
import DataManager from './db';
import { logger } from './logger';
import { errorWithCode } from './utils';
import { SSO_ROLE_MAP } from '../constants';

const dm = new DataManager(config);
const {
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
      let user = await User.findOne({
        where: {
          username: jwtPayload.preferred_username,
        },
      });

      if (!user) {
        user = await User.create({
          username: jwtPayload.preferred_username,
          givenName: jwtPayload.given_name,
          familyName: jwtPayload.family_name,
          email: jwtPayload.email,
        });
      }

      // Only active users can use the system
      if (!user.active) {
        return done(errorWithCode('This user account is not active.', 403), false); // Forbidden
      }

      // User roles are assigned in SSO and extracted from the JWT.
      // See the User object for additional functionality.
      const { roles } = jwtPayload.resource_access[config.get('sso:clientId')];
      if (!roles || !Object.values(SSO_ROLE_MAP).some(item => roles.includes(item))) {
        return done(errorWithCode('This user has no valid roles', 403), false); // Forbidden
      }

      // Update the last-login time of this user.
      user.lastLoginAt = new Date();
      await user.save();

      return done(null, Object.assign(user, { roles })); // OK
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
