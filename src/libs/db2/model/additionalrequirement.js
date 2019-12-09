'use strict';

import Model from './model';
import AdditionalRequirementCategory from './additionalrequirementcategory';

export default class AdditionalRequirement extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (AdditionalRequirement.fields.indexOf(`${AdditionalRequirement.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.category = data.category_id
      ? new AdditionalRequirementCategory(AdditionalRequirementCategory.extract(data))
      : null;
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'detail', 'url', 'category_id', 'plan_id', 'canonical_id']
      .map(field => `${this.table}.${field}`);
  }

  static get table() {
    return 'additional_requirement';
  }

  static async findWithCategory(db, where) {
    const myFields = [
      ...AdditionalRequirement.fields,
      ...AdditionalRequirementCategory.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(AdditionalRequirement.table)
        .leftJoin('ref_additional_requirement_category', { 'additional_requirement.category_id': 'ref_additional_requirement_category.id' })
        .where(where)
        .orderBy('id', 'asc');

      return results.map(row => new AdditionalRequirement(row, db));
    } catch (error) {
      throw error;
    }
  }
}
