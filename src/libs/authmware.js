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

import { logger, errorWithCode, getJwtCertificate } from '@bcgov/nodejs-common-utils';
import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import config from '../config';
import DataManager from './db2';

const dm = new DataManager(config);
const {
  db,
  User,
} = dm;

export default async function initPassport(app) {
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

  try {
    const {
      certificate,
      algorithm
    } = await getJwtCertificate(config.get('sso:certsUrl'));

    const opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.algorithms = [algorithm];
    opts.secretOrKey = certificate;
    opts.passReqToCallback = true;

    // For development purposes only ignore the expiration
    // time of tokens.
    if (config.get('environment') === 'development') {
      opts.ignoreExpiration = true;
    }

    const jwtStrategy = new JwtStrategy(opts, async (req, jwtPayload, done) => {
      try {

        let user;

        // first try the guid
        user = await User.findOne(db, {
          username: jwtPayload.preferred_username,
        });

        if (!user) {
          // try falling back by guessing what previous OIDC preferred username would have been
          let computedUsername = null;

          if (jwtPayload?.identity_provider === 'idir') {
            computedUsername = `idir\\${jwtPayload.idir_username.toLowerCase()}`;
          } else if (jwtPayload?.identity_provider === 'bceidbusiness') {
            computedUsername = `bceid\\${jwtPayload.bceid_username.toLowerCase()}`;
          }

          if (computedUsername !== null) {
            user = await User.findOne(db, {
              username: computedUsername,
            });
            console.log(`migrating user with computed old name ${computedUsername} to new format: ${jwtPayload.preferred_username}`);
            await User.update(db, {
              username: computedUsername,
            }, {
              username: jwtPayload.preferred_username,
            });
          }
        }

        if (!user) {
          // always create with the guid, if it iexists
          user = await User.create(db, {
            username: jwtPayload.preferred_username,
            email: jwtPayload.email,
            // givenName: jwtPayload.given_name,
            // familyName: jwtPayload.family_name,
          });
        }

        // User roles are assigned in SSO and extracted from the JWT.
        // See the User object for additional functionality.
        if (jwtPayload.client_roles.length !== 0) {
          user.roles = jwtPayload.client_roles;
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
  } catch (e) {
    logger.error(`Error initializing passport: ${e.message}`);
    process.exit(1);
  }
}
