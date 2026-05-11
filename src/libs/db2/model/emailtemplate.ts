import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class EmailTemplate extends KyselyModel {
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
  }

  static mapRow(row: Record<string, any>) {
    return {
      id: row.id,
      name: row.name,
      fromEmail: row.from_email,
      subject: row.subject,
      body: row.body,
    };
  }

  static get fields(): string[] {
    return ['id', 'name', 'from_email', 'subject', 'body'];
  }

  static get table(): string {
    return 'email_template';
  }

  static async update(_db: any, where: Record<string, any>, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      obj[EmailTemplate.toSnakeCase(key)] = values[key];
    });

    let query = db.updateTable('email_template').set(obj);
    Object.entries(where).forEach(([k, v]) => {
      query = query.where(k, '=', v);
    });
    const result = await query.returning('id').executeTakeFirst();

    if (result) {
      const rowsResult: any = await sql`
      SELECT email_template.* FROM email_template WHERE email_template.id = ${result.id}
    `.execute(db);
      const row = rowsResult.rows[0];
      return row ? [EmailTemplate.mapRow(row)] : [];
    }

    return [];
  }

  static async create(_db: any, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      obj[EmailTemplate.toSnakeCase(key)] = values[key];
    });

    const result = await db.insertInto('email_template').values(obj).returning('id').executeTakeFirst();

    if (result) {
      return EmailTemplate.findOne(_db, { id: result.id });
    }
    return null;
  }

  static async findWithExclusion(
    _db: any,
    where: Record<string, any>,
    order: string | null = null,
    exclude: [string, any],
  ) {
    const db = _db || kyselyDb;
    let query: any = db.selectFrom('email_template').select('id');
    Object.entries(where).forEach(([k, v]) => {
      query = query.where(k, '=', v);
    });

    if (exclude) {
      query = query.where(exclude[0], '!=', exclude[1]);
    }

    const results = await query.execute();
    const emailTemplateIds = results.map((obj: Record<string, any>) => obj.id);

    if (emailTemplateIds.length === 0) return [];

    const rawResults: any = await sql`
      SELECT DISTINCT ON (email_template.id) id, email_template.* FROM email_template
      WHERE email_template.id IN (${sql.join(emailTemplateIds)})
      ORDER BY email_template.id, ${sql.raw(order || 'email_template.id')}
    `.execute(db);

    return rawResults.rows.map(EmailTemplate.mapRow);
  }
}
