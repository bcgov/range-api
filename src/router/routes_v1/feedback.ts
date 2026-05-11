// @ts-nocheck
'use strict';

import { Router } from 'express';
import config from '../../config/index.js';
import DataManager from '../../libs/db2/index.js';
import { checkRequiredFields } from '../../libs/utils.js';

const dm = new DataManager(config);
const { db, UserFeedback } = dm;

const router = new Router();

router.post('/', async (req, res) => {
  const { body, user } = req;

  checkRequiredFields(['anonymous', 'section', 'feedback'], 'body', req);

  const { anonymous } = body;
  const feedback = await UserFeedback.create(db, {
    ...body,
    user_id: anonymous ? null : user.id,
  });

  res.status(200).json(feedback).end();
});

router.get('/', async (req, res) => {
  const feedbacks = await UserFeedback.findWithUser(db, {});
  res.status(200).json(feedbacks).end();
});

export default router;
