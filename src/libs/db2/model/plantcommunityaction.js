'use strict';

import Model from './model';
import PlantCommunityActionType from './plantcommunityactiontype';

export default class PlantCommunityAction extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (
        PlantCommunityAction.fields.indexOf(
          `${PlantCommunityAction.table}.${key}`,
        ) > -1
      ) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.actionType = data.action_type_id
      ? new PlantCommunityActionType(PlantCommunityActionType.extract(data))
      : null;
  }

  static get fields() {
    // primary key *must* be first!
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
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'plant_community_action';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...PlantCommunityAction.fields,
      ...PlantCommunityActionType.fields.map(
        (f) => `${f} AS ${f.replace('.', '_')}`,
      ),
    ];

    try {
      const results = await db
        .select(myFields)
        .from(PlantCommunityAction.table)
        .leftJoin('ref_plant_community_action_type', {
          'plant_community_action.action_type_id':
            'ref_plant_community_action_type.id',
        })
        .where(where)
        .orderBy('plant_community_action.created_at', 'asc');

      return results.map((row) => new PlantCommunityAction(row, db));
    } catch (error) {
      throw error;
    }
  }
}
