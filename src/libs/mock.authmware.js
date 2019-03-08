
import { logger } from '@bcgov/nodejs-common-utils';
import { MockStrategy } from 'passport-mock-strategy';
import express from 'express';
import passport from 'passport';
import config from '../config';
import DataManager from './db2';

const dm = new DataManager(config);
const {
  db,
  User,
} = dm;

module.exports = () => {
  const app = express();
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
  passport.use(new MockStrategy({
    name: 'mock',
    user: {},
  }, async (u, done) => {
    console.log('**** Test *****');
    const user = await User.findOne(db, {
      username: 'rangeadmin',
    });
    done(null, user);
  }));

  return app;
};
