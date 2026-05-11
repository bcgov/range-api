import { db as kyselyDb } from '../kysely.js';

type ModelData = Record<string, unknown>;

export default class KyselyModel {
  constructor(data: ModelData, _db?: any) {
    Object.assign(this, (this.constructor as typeof KyselyModel).transformToCamelCase(data));
  }

  static get fields(): string[] {
    throw new Error('You must override fields()');
  }

  static get table(): string {
    throw new Error('You must override table()');
  }

  static get primaryKey(): string {
    return this.fields[0];
  }

  static toCamelCase(str: string): string {
    return str
      .replace(/_/g, ' ')
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter: string, index: number) => {
        return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  static toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, ($1: string) => `_${$1.toLowerCase()}`);
  }

  static transformToCamelCase(data: ModelData): ModelData {
    const obj: ModelData = {};
    Object.keys(data).forEach((key: string) => {
      obj[this.toCamelCase(key)] = data[key];
    });
    return obj;
  }

  static async find(_db: any, where: Record<string, any>, order?: [string, string]) {
    const hasEmptyIn = Object.values(where).some((v) => Array.isArray(v) && v.length === 0);
    if (hasEmptyIn) {
      return [];
    }

    const db = _db || kyselyDb;
    let query = db.selectFrom(this.table).selectAll();
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    if (order && order.length > 0) {
      query = query.orderBy(order[0], order[1] || 'asc');
    }
    const results = await query.execute();
    return results.map((row: ModelData) => new (this as any)(row, _db));
  }

  static async findOne(_db: any, where: Record<string, any>) {
    const results = await this.find(_db, where);
    return results.pop();
  }

  static async findById(_db: any, id: any) {
    const where: Record<string, any> = {};
    where[this.primaryKey] = id;
    return this.findOne(_db, where);
  }

  static async create(_db: any, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    const snakeFields = this.fields.slice();
    this.fields.forEach((key: string) => {
      if (values[this.toCamelCase(key)] !== undefined) {
        obj[key] = values[this.toCamelCase(key)];
      } else if (values[key] !== undefined) {
        obj[key] = values[key];
      }
    });
    const results = await db.insertInto(this.table).values(obj).returning(this.primaryKey).execute();
    const pk = typeof results[0] === 'number' ? results[0] : results[0][this.primaryKey];
    if (snakeFields.includes('canonical_id') && !(values.canonicalId || values.canonical_id)) {
      await this.setCanonicalId(_db, pk);
    }
    return this.findById(_db, pk);
  }

  static async update(_db: any, where: Record<string, any>, values: Record<string, any>) {
    const db = _db || kyselyDb;
    const obj: Record<string, any> = {};
    this.fields.slice(1).forEach((key: string) => {
      const camelKey = this.toCamelCase(key);
      if (values[camelKey] !== undefined) {
        obj[key] = values[camelKey];
      } else if (values[key] !== undefined) {
        obj[key] = values[key];
      }
    });
    if (Object.keys(obj).length === 0) return this.findOne(_db, where);
    let query = db.updateTable(this.table).set(obj);
    Object.entries(where).forEach(([k, v]) => {
      query = (query as any).where(k, '=', v);
    });
    const results = await (query as any).returning(this.primaryKey).execute();
    if (results.length > 0)
      return this.findById(_db, typeof results[0] === 'number' ? results[0] : results[0][this.primaryKey]);
    return [];
  }

  static async remove(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    let query = db.deleteFrom(this.table);
    Object.entries(where).forEach(([k, v]) => {
      query = (query as any).where(k, '=', v);
    });
    const results = await (query as any).execute();
    return results.length;
  }

  static async removeById(_db: any, id: any) {
    const where: Record<string, any> = {};
    where[this.primaryKey] = id;
    return this.remove(_db, where);
  }

  static async count(_db: any, where: Record<string, any> = {}) {
    const db = _db || kyselyDb;
    let query = db.selectFrom(this.table).select(db.fn.countAll().as('count'));
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    const results = await query.execute();
    if (results.length === 0) return 0;
    const count = parseInt((results[0] as Record<string, string>).count, 10);
    return !Number.isNaN(count) ? count : 0;
  }

  static async setCanonicalId(_db: any, id: any) {
    const data = await this.findById(_db, id);
    return this.update(_db, { id }, { canonical_id: data.canonical_id || data.id });
  }

  static extract(data: Record<string, any>): Record<string, any> {
    const obj: Record<string, any> = {};
    Object.keys(data).forEach((key: string) => {
      const prefix = this.table;
      if (key.startsWith(prefix)) {
        const aKey = key.replace(prefix, '').slice(1);
        obj[aKey] = data[key];
      }
    });
    return obj;
  }
}
