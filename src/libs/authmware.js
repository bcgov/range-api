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
import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import config from '../config';
import DataManager from './db2';
import { SSO_ROLE_MAP } from '../constants';
import UserPermissions from './db2/model/userPermissions';

const dm = new DataManager(config);
const { db, User } = dm;

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
    const opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.passReqToCallback = true;
    opts.secretOrKeyProvider = jwksRsa.passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: config.get('sso:certsUrl'),
    });

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

          if (jwtPayload?.identity_provider.toLowerCase().includes('idir')) {
            computedUsername = `idir\\${jwtPayload.idir_username.toLowerCase()}`;
          } else if (
            jwtPayload?.identity_provider.toLowerCase().includes('bceid')
          ) {
            computedUsername = `bceid\\${jwtPayload.bceid_username.toLowerCase()}`;
          }

          if (computedUsername !== null) {
            user = await User.findOne(db, {
              username: computedUsername,
            });
            if (user == null) {
              console.log(
                `user ${computedUsername} not found in database, not migrating`,
              );
            } else {
              console.log(
                `migrating user with computed old name ${computedUsername} to new format: ${jwtPayload.preferred_username}`,
              );
              await User.update(
                db,
                {
                  username: computedUsername,
                },
                {
                  username: jwtPayload.preferred_username,
                },
              );
            }
          }
        }

        if (!user) {
          // always create with the guid, if it exists
          user = await User.create(db, {
            username: jwtPayload.preferred_username,
            email: jwtPayload.email,
          });
        }
        let ssoId = null;
        if (jwtPayload?.identity_provider.toLowerCase().includes('idir')) {
          ssoId = `idir\\${jwtPayload.idir_username.toLowerCase()}`;
        } else if (
          jwtPayload?.identity_provider.toLowerCase().includes('bceid')
        ) {
          ssoId = `bceid\\${jwtPayload.bceid_username.toLowerCase()}`;
        }
        await User.update(
          db,
          {
            id: user.id,
          },
          {
            ssoId: ssoId,
          },
        );
        // User roles are assigned in SSO and extracted from the JWT.
        // See the User object for additional functionality.

        // minimal set of roles based on auth provider
        const basicRoles = [];
        if (jwtPayload?.identity_provider === 'idir') {
          let needsRO = true;
          if (jwtPayload.client_roles && jwtPayload.client_roles.length !== 0) {
            if (jwtPayload.client_roles.includes(SSO_ROLE_MAP.DECISION_MAKER)) {
              needsRO = false;
            }
          }
          if (needsRO) {
            basicRoles.push(SSO_ROLE_MAP.RANGE_OFFICER);
          }
        } else if (
          jwtPayload?.identity_provider.toLowerCase().includes('bceid')
        ) {
          let needsClientRole = true;

          if (jwtPayload.client_roles && jwtPayload.client_roles.length !== 0) {
            if (jwtPayload.client_roles.includes(SSO_ROLE_MAP.ADMINISTRATOR)) {
              needsClientRole = false;
            }
          }
          if (needsClientRole) {
            basicRoles.push(SSO_ROLE_MAP.AGREEMENT_HOLDER);
          }
        }

        if (jwtPayload.client_roles && jwtPayload.client_roles.length !== 0) {
          // dedup roles
          user.roles = basicRoles.concat(
            jwtPayload.client_roles.filter((r) => basicRoles.indexOf(r) < 0),
          );
        } else {
          user.roles = basicRoles;
        }

        //Add new permissions based on roles
        let permissions = [];
        let roleIdToAdd = 4; //Default Client/RUP agreement holder
        if (user.roleId) {
          //Get permissions if available
          permissions = await UserPermissions.getRolePermissions(
            db,
            user.roleId,
          );
        } else {
          //set role id based on jwt
          if (jwtPayload.client_roles && jwtPayload.client_roles.length !== 0) {
            if (jwtPayload.client_roles.includes(SSO_ROLE_MAP.ADMINISTRATOR)) {
              roleIdToAdd = 1; //Admin
            } else if (
              jwtPayload.client_roles.includes(SSO_ROLE_MAP.READ_ONLY)
            ) {
              roleIdToAdd = 5; //Read only external auditor
            } else if (
              jwtPayload.client_roles.includes(SSO_ROLE_MAP.DECISION_MAKER)
            ) {
              roleIdToAdd = 2; //Decision maker
            } else if (
              jwtPayload.client_roles.includes(SSO_ROLE_MAP.RANGE_OFFICER)
            ) {
              roleIdToAdd = 3; //Agrologist
            }
          } else {
            if (jwtPayload?.identity_provider === 'idir') {
              roleIdToAdd = 3; //Agrologist
            }
          }

          await User.update(
            db,
            {
              id: user.id,
            },
            {
              roleId: roleIdToAdd, //Defaults to client
            },
          );
          user.roleId = roleIdToAdd;

          permissions = await UserPermissions.getRolePermissions(
            db,
            roleIdToAdd,
          );
        }

        //Set permissions
        user.permissions = permissions;

        if (!user.isActive()) {
          return done(
            errorWithCode(
              'This account is not active yet. Please contact the administrator(MyRangeBC@gov.bc.ca).',
              403,
            ),
            false,
          ); // Forbidden
        }

        // Update the last-login time of this user.
        await User.update(
          db,
          {
            username: jwtPayload.preferred_username,
          },
          {
            lastLoginAt: new Date(),
          },
        );

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
