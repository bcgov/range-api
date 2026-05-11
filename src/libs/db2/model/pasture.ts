import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import PlantCommunity from './plantcommunity.js';

export default class Pasture extends KyselyModel {
  declare id: number;
  declare name: string;
  declare allowableAum: number | null;
  declare graceDays: number | null;
  declare pldPercent: number | null;
  declare notes: string | null;
  declare planId: number;
  plantCommunities: any[] = [];

  static get fields(): string[] {
    return [
      'id',
      'name',
      'allowable_aum',
      'grace_days',
      'pld_percent',
      'notes',
      'plan_id',
      'canonical_id',
      'created_at',
    ];
  }

  static get table(): string {
    return 'pasture';
  }

  static get primaryKey(): string {
    return 'id';
  }

  async fetchPlantCommunities(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const plantCommunities = await PlantCommunity.findWithElevationAndType(db, where);
    const promises = plantCommunities.map((p: any) => [
      p.fetchIndicatorPlants(db, { plant_community_id: p.id }),
      p.fetchMonitoringAreas(db, { plant_community_id: p.id }),
      p.fetchPlantCommunityActions(db, { plant_community_id: p.id }),
    ]);
    await Promise.all(promises.flat());
    this.plantCommunities = plantCommunities || [];
  }
}
