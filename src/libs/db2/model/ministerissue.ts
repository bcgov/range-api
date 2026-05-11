import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import MinisterIssueType from './ministerissuetype.js';
import MinisterIssueAction from './ministerissueaction.js';

export default class MinisterIssue extends KyselyModel {
  declare id: any;
  declare detail: any;
  declare objective: any;
  declare identified: any;
  declare issueTypeId: any;
  declare planId: any;
  declare canonicalId: any;
  declare createdAt: any;
  declare ministerIssueType: MinisterIssueType;
  ministerIssueActions: any[] = [];
  pastures: any[] = [];

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.ministerIssueType = new MinisterIssueType(MinisterIssueType.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'detail', 'objective', 'identified', 'issue_type_id', 'plan_id', 'canonical_id', 'created_at'];
  }

  static get table(): string {
    return 'minister_issue';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields = [
      'minister_issue.id',
      'minister_issue.detail',
      'minister_issue.objective',
      'minister_issue.identified',
      'minister_issue.issue_type_id',
      'minister_issue.plan_id',
      'minister_issue.canonical_id',
      'minister_issue.created_at',
      sql`ref_minister_issue_type.id`.as('ref_minister_issue_type_id'),
      sql`ref_minister_issue_type.name`.as('ref_minister_issue_type_name'),
      sql`ref_minister_issue_type.active`.as('ref_minister_issue_type_active'),
    ];
    let query: any = db
      .selectFrom('minister_issue')
      .innerJoin('ref_minister_issue_type', 'minister_issue.issue_type_id', 'ref_minister_issue_type.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('minister_issue.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: Record<string, any>) => new MinisterIssue(row, _db));
  }

  async fetchMinisterIssueActions(_db?: any, where?: Record<string, any>) {
    const db = _db || kyselyDb;
    const ministerIssueActions = await MinisterIssueAction.findWithType(db, where || {});
    this.ministerIssueActions = ministerIssueActions || [];
  }

  async fetchPastureIds(_db?: any, where?: Record<string, any>) {
    const db = _db || kyselyDb;
    let query: any = db.selectFrom('minister_issue_pasture').select('pasture_id');
    Object.entries(where || {}).forEach(([k, v]) => {
      query = query.where(k, '=', v);
    });
    const pastures = await query.execute();
    const pastureIds = pastures.map((p: Record<string, any>) => p.pasture_id);
    this.pastures = pastureIds || [];
  }
}
