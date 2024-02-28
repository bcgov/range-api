//
// Code Sign
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
// Created by Jason Leach on 2018-05-06.
//

/* eslint-disable no-unused-vars */

import assert from 'assert';

const passport = jest.requireActual('passport');

const user = {
  id: 1,
  roles: [],
  isAgreementHolder: () => false,
};

const canAccessAgreement = async (db, agreement) => {
  assert(db);
  assert(agreement);
  const clients = agreement.clients.filter(
    (client) => client.id === user.clientId,
  );
  if (user.isAdministrator()) {
    return true;
  }
  if (user.isAgreementHolder()) {
    return clients.length > 0;
  }
  if (user.isRangeOfficer()) {
    const val = user.id === 1;
    return val;
  }
  return false;
};

passport.aUser = user;
passport.aUser.canAccessAgreement = canAccessAgreement.bind(user);
passport.aUser.getLinkedClientNumbers = jest
  .fn()
  .mockReturnValue(() => [3, 4, 5]);
passport.global = {};
passport.setGlobal = (key, value) => {
  passport.global[key] = value;
};
passport.clearGlobal = (key) => {
  delete passport.global[key];
};

function authenticate(strategy, options) {
  'use strict';

  return (req, res, next) => {
    req.user = passport.aUser;
    req.isAuthenticated = () => true; // Skip calling jwtStrategy, auth the request straight
    next();
  };
}

passport.authenticate = authenticate;

module.exports = passport;
