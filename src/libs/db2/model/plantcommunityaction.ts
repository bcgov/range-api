import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import PlantCommunityActionType from './plantcommunityactiontype.js';

export default class PlantCommunityAction extends KyselyModel {
  declare id: number;
  declare plantCommunityId: number;
  declare actionTypeId: number;
  declare name: string;
  declare details: string;
  declare noGrazeStartDay: number;
  declare noGrazeStartMonth: number;
  declare noGrazeEndDay: number;
  declare noGrazeEndMonth: number;
  declare canonicalId: number;
  declare createdAt: string;
  actionType: any = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.actionType = data.action_type_id ? new PlantCommunityActionType(PlantCommunityActionType.extract(data)) : null;
  }

  static get fields(): string[] {
    return [
      'id',
      'plant_community_id',
      'action_type_id',
      'name',
      'details',
      'no_graze_start_day',
      'no_graze_start_month',
      'no_graze_end_day',
      'no_graze_end_month',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'plant_community_action';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'plant_community_action.id',
      'plant_community_action.plant_community_id',
      'plant_community_action.action_type_id',
      'plant_community_action.name',
      'plant_community_action.details',
      'plant_community_action.no_graze_start_day',
      'plant_community_action.no_graze_start_month',
      'plant_community_action.no_graze_end_day',
      'plant_community_action.no_graze_end_month',
      'plant_community_action.canonical_id',
      'plant_community_action.created_at',
      sql`ref_plant_community_action_type.id`.as('ref_plant_community_action_type_id'),
      sql`ref_plant_community_action_type.name`.as('ref_plant_community_action_type_name'),
      sql`ref_plant_community_action_type.active`.as('ref_plant_community_action_type_active'),
    ];
    let query: any = db
      .selectFrom('plant_community_action')
      .leftJoin(
        'ref_plant_community_action_type',
        'plant_community_action.action_type_id',
        'ref_plant_community_action_type.id',
      )
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('plant_community_action.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: any) => new PlantCommunityAction(row, _db));
  }
}
