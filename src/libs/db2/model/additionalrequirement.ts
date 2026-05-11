import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import AdditionalRequirementCategory from './additionalrequirementcategory.js';

export default class AdditionalRequirement extends KyselyModel {
  declare id: any;
  declare detail: any;
  declare url: any;
  declare categoryId: any;
  declare planId: any;
  declare canonicalId: any;
  declare createdAt: any;
  category: AdditionalRequirementCategory | null = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.category = data.category_id
      ? new AdditionalRequirementCategory(AdditionalRequirementCategory.extract(data))
      : null;
  }

  static get fields(): string[] {
    return ['id', 'detail', 'url', 'category_id', 'plan_id', 'canonical_id', 'created_at'];
  }

  static get table(): string {
    return 'additional_requirement';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithCategory(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields = [
      'additional_requirement.id',
      'additional_requirement.detail',
      'additional_requirement.url',
      'additional_requirement.category_id',
      'additional_requirement.plan_id',
      'additional_requirement.canonical_id',
      'additional_requirement.created_at',
      sql`ref_additional_requirement_category.id`.as('ref_additional_requirement_category_id'),
      sql`ref_additional_requirement_category.name`.as('ref_additional_requirement_category_name'),
      sql`ref_additional_requirement_category.active`.as('ref_additional_requirement_category_active'),
    ];
    let query: any = db
      .selectFrom('additional_requirement')
      .leftJoin(
        'ref_additional_requirement_category',
        'additional_requirement.category_id',
        'ref_additional_requirement_category.id',
      )
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('additional_requirement.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: Record<string, any>) => new AdditionalRequirement(row, _db));
  }
}
