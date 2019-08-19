//
// MyRA
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
// Created by Jason Leach on 2018-05-08.
//

'use strict';

import { SSO_ROLE_MAP } from '../../../constants';
import Model from './model';

export default class User extends Model {
  constructor(data, db = undefined) {
    super(data, db);
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'username', 'client_id', 'given_name', 'family_name', 'email',
      'phone_number', 'active', 'pia_seen', 'last_login_at']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'user_account';
  }

  static async update(db, where, values) {
    const obj = { };
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const count = await db
        .table(User.table)
        .where(where)
        .update(obj);

      if (count > 0) {
        return await User.findOne(db, where);
      }

      return [];
    } catch (err) {
      throw err;
    }
  }

  static async create(db, values) {
    const obj = { };
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const results = await db
        .table(User.table)
        .returning('id')
        .insert(obj);

      return await User.findOne(db, { id: results.pop() });
    } catch (err) {
      throw err;
    }
  }

  static async findWithExclusion(db, where, order, exclude) {
    try {
      const q = db
        .table(User.table)
        .select('id')
        .where(where);

      if (exclude) {
        q.andWhereNot(...exclude);
      }

      const results = await q;
      const userIds = results.map(obj => obj.id);

      return await User.find(db, { id: userIds }, order);
    } catch (err) {
      throw err;
    }
  }
}

//
// Instance Method
//

/* eslint-disable func-names, arrow-body-style */

User.prototype.isActive = function () {
  if (this.active && Object.values(SSO_ROLE_MAP).some(item => this.roles.includes(item))) {
    return true;
  }

  return false;
};

User.prototype.canAccessAgreement = async function (db, agreement) {
  if (!db || !agreement) {
    return false;
  }

  if (this.isAdministrator()) {
    return true;
  }

  if (this.isAgreementHolder()) {
    const [result] = await db
      .table('client_agreement')
      .where({ agreement_id: agreement.forestFileId, client_id: this.clientId })
      .count();
    const { count } = result || {};
    return count !== '0';
  }

  if (this.isRangeOfficer()) {
    const [result] = await db
      .table('agreement')
      .join('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .where({ 'ref_zone.user_id': this.id, 'agreement.forest_file_id': agreement.forestFileId })
      .count();
    const { count } = result || {};
    return count !== '0';
  }

  return false;
};

User.prototype.isAdministrator = function () {
  return this.roles && this.roles.includes(SSO_ROLE_MAP.ADMINISTRATOR);
};

User.prototype.isAgreementHolder = function () {
  return this.roles && this.roles.includes(SSO_ROLE_MAP.AGREEMENT_HOLDER);
};

User.prototype.isRangeOfficer = function () {
  return this.roles && this.roles.includes(SSO_ROLE_MAP.RANGE_OFFICER);
};
