import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import MinisterIssueActionType from './ministerissueactiontype.js';

export default class MinisterIssueAction extends KyselyModel {
  declare id: number;
  declare detail: string;
  declare actionTypeId: number;
  declare issueId: number;
  declare other: string;
  declare noGrazeStartDay: number;
  declare noGrazeStartMonth: number;
  declare noGrazeEndDay: number;
  declare noGrazeEndMonth: number;
  declare canonicalId: number;
  declare createdAt: string;
  declare ministerIssueActionType: any;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.ministerIssueActionType = new MinisterIssueActionType(MinisterIssueActionType.extract(data));
  }

  static get fields(): string[] {
    return [
      'id',
      'detail',
      'action_type_id',
      'issue_id',
      'other',
      'no_graze_start_day',
      'no_graze_start_month',
      'no_graze_end_day',
      'no_graze_end_month',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'minister_issue_action';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'minister_issue_action.id',
      'minister_issue_action.detail',
      'minister_issue_action.action_type_id',
      'minister_issue_action.issue_id',
      'minister_issue_action.other',
      'minister_issue_action.no_graze_start_day',
      'minister_issue_action.no_graze_start_month',
      'minister_issue_action.no_graze_end_day',
      'minister_issue_action.no_graze_end_month',
      'minister_issue_action.canonical_id',
      'minister_issue_action.created_at',
      sql`ref_minister_issue_action_type.id`.as('ref_minister_issue_action_type_id'),
      sql`ref_minister_issue_action_type.name`.as('ref_minister_issue_action_type_name'),
      sql`ref_minister_issue_action_type.placeholder`.as('ref_minister_issue_action_type_placeholder'),
      sql`ref_minister_issue_action_type.active`.as('ref_minister_issue_action_type_active'),
    ];
    let query: any = db
      .selectFrom('minister_issue_action')
      .innerJoin(
        'ref_minister_issue_action_type',
        'minister_issue_action.action_type_id',
        'ref_minister_issue_action_type.id',
      )
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('minister_issue_action.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: any) => new MinisterIssueAction(row, _db));
  }
}
