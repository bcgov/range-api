"use strict";

import Model from "./model";

export default class EmailTemplate extends Model {
  constructor(data, db = undefined) {
    super(data, db);
  }

  static mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      fromEmail: row.from_email,
      subject: row.subject,
      body: row.body,
    };
  }

  static get fields() {
    // primary key *must* be first!
    return [
      "id",
      "name",
      "from_email",
      "subject",
      "body",
    ].map(field => `${this.table}.${field}`);
  }

  static get table() {
    return "email_template";
  }

  static async update(db, where, values) {
    const obj = {};
    Object.keys(values).forEach(key => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const count = await db
        .table(EmailTemplate.table)
        .where(where)
        .update(obj);

      if (count > 0) {
        const [{ id }] = await db
          .table(EmailTemplate.table)
          .where(where)
          .returning("id");

        const res = await db.raw(
          `
          SELECT email_template.* FROM email_template
          WHERE email_template.id = ?;
        `,
          [id]
        );
        return res.rows.map(EmailTemplate.mapRow)[0];
      }

      return [];
    } catch (err) {
      throw err;
    }
  }

  static async create(db, values) {
    const obj = {};
    Object.keys(values).forEach(key => {
      obj[Model.toSnakeCase(key)] = values[key];
    });

    try {
      const results = await db
        .table(EmailTemplate.table)
        .returning("id")
        .insert(obj);

      return await EmailTemplate.findOne(db, { id: results.pop() });
    } catch (err) {
      throw err;
    }
  }

  static async findWithExclusion(db, where, order = null, exclude) {
    try {
      const q = db
        .table(EmailTemplate.table)
        .select("id")
        .where(where);

      if (exclude) {
        q.andWhereNot(...exclude);
      }

      const results = await q;
      const emailTemplateIds = results.map(obj => obj.id);

      const res = await db.raw(
        `
        SELECT DISTINCT ON (email_template.id) id, email_template.* FROM email_template
        WHERE email_template.id = ANY (?) ORDER BY email_template.id, ?;
      `,
        [emailTemplateIds, order],
      );

      return res.rows.map(EmailTemplate.mapRow);
    } catch (err) {
      throw err;
    }
  }
}
