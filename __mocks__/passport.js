import assert from 'assert';
import passport from 'passport';

const user = {
  id: 1,
  roles: [],
  isAgreementHolder: () => false,
};

const canAccessAgreement = async (db, agreement) => {
  assert(db);
  assert(agreement);
  const clients = agreement.clients.filter((client) => client.id === user.clientId);
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
passport.aUser.getLinkedClientNumbers = jest.fn().mockReturnValue(() => [3, 4, 5]);
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
