'use strict';

import { asyncMiddleware } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import { checkRequiredFields } from '../../libs/utils';

const dm = new DataManager(config);
const { db, UserFeedback } = dm;

const router = new Router();

router.post(
  '/',
  asyncMiddleware(async (req, res) => {
    const { body, user } = req;

    checkRequiredFields(['anonymous', 'section', 'feedback'], 'body', req);

    try {
      const { anonymous } = body;
      const feedback = await UserFeedback.create(db, {
        ...body,
        user_id: anonymous ? null : user.id,
      });

      res.status(200).json(feedback).end();
    } catch (error) {
      throw error;
    }
  }),
);

router.get(
  '/',
  asyncMiddleware(async (req, res) => {
    try {
      const feedbacks = await UserFeedback.findWithUser(db, {});
      res.status(200).json(feedbacks).end();
    } catch (error) {
      throw error;
    }
  }),
);

module.exports = router;
