'use strict';

import Model from './model';

export default class PlanExtensionRequests extends Model {
  constructor(data, db = undefined) {
    super(data, db);
  }

  static mapRow(row) {
    return {
      id: row.id,
      planId: row.plan_id,
      clientId: row.client_id,
      userId: row.user_id,
      email: row.email,
      requestedExtension: row.requested_extension,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'plan_id',
      'client_id',
      'user_id',
      'email',
      'requested_extension',
      'created_at',
      'updated_at',
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'plan_extension_requests';
  }

  static async update(db, where, values) {
    const obj = {};
    Object.keys(values).forEach((key) => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const count = await db
        .table(PlanExtensionRequests.table)
        .where(where)
        .update(obj);

      if (count > 0) {
        const [{ id }] = await db
          .table(PlanExtensionRequests.table)
          .where(where)
          .returning('id');

        const res = await db.raw(
          `
          SELECT plan_extension_requests.* FROM plan_extension_requests
          WHERE plan_extension_requests.id = ?;
        `,
          [id],
        );
        return res.rows.map(PlanExtensionRequests.mapRow)[0];
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
      const results = await db
        .table(PlanExtensionRequests.table)
        .returning('id')
        .insert(obj);

      return await PlanExtensionRequests.findOne(db, { id: results.pop() });
    } catch (err) {
      throw err;
    }
  }

  static async findWithExclusion(db, where, order = null, exclude) {
    try {
      const q = db
        .table(PlanExtensionRequests.table)
        .select('id')
        .where(where);

      if (exclude) {
        q.andWhereNot(...exclude);
      }

      const results = await q;
      const planExtensionRequestIds = results.map(obj => obj.id);

      const res = await db.raw(
        `
        SELECT DISTINCT ON (plan_extension_requests.id) id, plan_extension_requests.* FROM plan_extension_requests
        WHERE plan_extension_requests.id = ANY (?) ORDER BY plan_extension_requests.id, ?;
      `,
        [planExtensionRequestIds, order],
      );

      return res.rows.map(PlanExtensionRequests.mapRow);
    } catch (err) {
      throw err;
    }
  }
}