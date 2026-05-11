import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import PlantSpecies from './plantspecies.js';

export default class IndicatorPlant extends KyselyModel {
  declare id: any;
  declare plantSpeciesId: any;
  declare plantCommunityId: any;
  declare criteria: any;
  declare value: any;
  declare name: any;
  declare canonicalId: any;
  declare createdAt: any;
  plantSpecies: PlantSpecies | null = null;

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.plantSpecies = data.plant_species_id ? new PlantSpecies(PlantSpecies.extract(data)) : null;
  }

  static get fields(): string[] {
    return ['id', 'plant_species_id', 'plant_community_id', 'criteria', 'value', 'name', 'canonical_id', 'created_at'];
  }

  static get table(): string {
    return 'indicator_plant';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static async findWithType(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const selectFields = [
      'indicator_plant.id',
      'indicator_plant.plant_species_id',
      'indicator_plant.plant_community_id',
      'indicator_plant.criteria',
      'indicator_plant.value',
      'indicator_plant.name',
      'indicator_plant.canonical_id',
      'indicator_plant.created_at',
      sql`ref_plant_species.id`.as('ref_plant_species_id'),
      sql`ref_plant_species.name`.as('ref_plant_species_name'),
      sql`ref_plant_species.leaf_stage`.as('ref_plant_species_leaf_stage'),
      sql`ref_plant_species.stubble_height`.as('ref_plant_species_stubble_height'),
      sql`ref_plant_species.annual_growth`.as('ref_plant_species_annual_growth'),
      sql`ref_plant_species.is_shrub_use`.as('ref_plant_species_is_shrub_use'),
      sql`ref_plant_species.active`.as('ref_plant_species_active'),
    ];
    let query: any = db
      .selectFrom('indicator_plant')
      .leftJoin('ref_plant_species', 'indicator_plant.plant_species_id', 'ref_plant_species.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.orderBy('indicator_plant.created_at', 'asc');
    const results = await query.execute();
    return results.map((row: Record<string, any>) => new IndicatorPlant(row, _db));
  }
}
