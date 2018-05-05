//
// Copyright (c) 2018 Fullboar Creative, Corp. All rights reserved.
//
// This software and documentation is the confidential and proprietary
// information of Fullboar Creative, Corp.
// ("Confidential Information"). You shall not disclose such Confidential
// Information and shall use it only in accordance with the terms of the
// license agreement you entered into with Fullboar Creative, Corp.
//

/* eslint-env es6 */

'use strict';

// import fs from 'fs';
// import path from 'path';
import knex from 'knex';
import Agreement from './model/agreement';
import District from './model/district';
import Zone from './model/zone';

export default class DataManager {
  constructor(config) {
    this.db = knex({
      client: 'pg',
      connection: {
        user: config.get('db:user'),
        database: config.get('db:database'),
        port: 5432,
        host: config.get('db:host'),
        password: config.get('db:password'),
      },
      searchPath: ['public'],
      debug: false,
      pool: {
        min: 1,
        max: 2,
      },
    });

    this.config = config;
    this.Agreement = Agreement;
    this.Zone = Zone;
    this.District = District;
  }
}
