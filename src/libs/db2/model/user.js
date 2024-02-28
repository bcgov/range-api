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
import UserClientLink from './userclientlink';

export default class User extends Model {
  constructor(data, db = undefined) {
    super(data, db);
  }

  static mapRow(row) {
    return {
      id: row.id,
      username: row.username,
      givenName: row.given_name,
      familyName: row.family_name,
      email: row.email,
      piaSeen: row.pia_seen,
      active: row.active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      clientNumber: row.client_number,
      phoneNumber: row.phone_number,
      ssoId: row.sso_id,
    };
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'username',
      'given_name',
      'family_name',
      'email',
      'phone_number',
      'active',
      'pia_seen',
      'last_login_at',
      'sso_id',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'user_account';
  }

  static async update(db, where, values) {
    const obj = {};
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const count = await db.table(User.table).where(where).update(obj);

      if (count > 0) {
        //   const res = await db.raw(`
        //   SELECT user_account.*, ref_client.client_number FROM user_account
        //   LEFT JOIN ref_client ON user_account.client_id = ref_client.id
        //   WHERE user_account.id = ANY (?) ORDER BY ?;
        // ` );

        // return res.rows.map(this.mapRow);
        const [{ id }] = await db
          .table(User.table)
          .where(where)
          .returning('id');

        const res = await db.raw(
          `
          SELECT user_account.*, ref_client.client_number FROM user_account
          LEFT JOIN user_client_link ON user_client_link.user_id = user_account.id
          LEFT JOIN ref_client ON ref_client.client_number = user_client_link.client_id
          WHERE user_account.id = ?;
        `,
          [id],
        );
        return res.rows.map(User.mapRow)[0];
      }

      return [];
    } catch (err) {
      throw err;
    }
  }

  static async create(db, values) {
    const obj = {};
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const results = await db.table(User.table).returning('id').insert(obj);

      return await User.findOne(db, { id: results.pop() });
    } catch (err) {
      throw err;
    }
  }

  static async findWithExclusion(db, where, order, exclude) {
    try {
      const q = db.table(User.table).select('id').where(where);

      if (exclude) {
        q.andWhereNot(...exclude);
      }

      const results = await q;
      const userIds = results.map((obj) => obj.id);

      const res = await db.raw(
        `
        SELECT DISTINCT ON (user_account.id) user_id, user_account.*, ref_client.client_number FROM user_account
        LEFT JOIN user_client_link ON user_client_link.user_id = user_account.id
        LEFT JOIN ref_client ON ref_client.client_number = user_client_link.client_id
        WHERE user_account.id = ANY (?) ORDER BY user_account.id, ?;
      `,
        [userIds, order],
      );

      return res.rows.map(User.mapRow);
    } catch (err) {
      throw err;
    }
  }

  async getLinkedClientNumbers(db) {
    const clientLinks = await UserClientLink.find(db, {
      user_id: this.id,
      active: true,
      // TODO: Remove after implementing agency agreements
      type: 'owner',
    });

    return clientLinks.map((clientLink) => clientLink.clientId);
  }

  static async fromClientId(db, clientId) {
    const [result] = await db
      .table('user_account')
      .join('user_client_link', {
        'user_client_link.user_id': 'user_account.id',
      })
      .where({
        'user_client_link.client_id': clientId,
      });
    return result || [];
  }
}

//
// Instance Method
//

/* eslint-disable func-names, arrow-body-style */

User.prototype.isActive = function () {
  if (
    this.active &&
    Object.values(SSO_ROLE_MAP).some((item) => this.roles.includes(item))
  ) {
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
    const clientIds = await this.getLinkedClientNumbers(db);

    const [result] = await db
      .table('client_agreement')
      .whereIn('client_agreement.client_id', clientIds)
      .andWhere({ agreement_id: agreement.forestFileId })
      .orWhere('client_agreement.agent_id', this.id)
      .andWhere({ agreement_id: agreement.forestFileId })
      .count();
    const { count } = result || {};
    return count !== '0';
  }

  if (this.isRangeOfficer()) {
    const [result] = await db
      .table('agreement')
      .join('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .join('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
      .where({
        'ref_zone.district_id': db.ref('ref_district.id'),
        'agreement.forest_file_id': agreement.forestFileId,
      })
      .count();
    const { count } = result || {};
    return count !== '0';
  }

  if (this.isDecisionMaker()) {
    const [result] = await db
      .table('agreement')
      .join('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .join('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
      .where({
        'ref_district.user_id': this.id,
        'agreement.forest_file_id': agreement.forestFileId,
      })
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

User.prototype.isDecisionMaker = function () {
  return this.roles && this.roles.includes(SSO_ROLE_MAP.DECISION_MAKER);
};
