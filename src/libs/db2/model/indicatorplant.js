'use strict';

import Model from './model';
import PlantSpecies from './plantspecies';

export default class IndicatorPlant extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (
        IndicatorPlant.fields.indexOf(`${IndicatorPlant.table}.${key}`) > -1
      ) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.plantSpecies = data.plant_species_id
      ? new PlantSpecies(PlantSpecies.extract(data))
      : null;
  }

  static get fields() {
    // primary key *must* be first!
    return [
      'id',
      'plant_species_id',
      'plant_community_id',
      'criteria',
      'value',
      'name',
      'canonical_id',
      'created_at',
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'indicator_plant';
  }

  static async findWithType(db, where) {
    const myFields = [
      ...IndicatorPlant.fields,
      ...PlantSpecies.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];

    const results = await db
      .select(myFields)
      .from(IndicatorPlant.table)
      .leftJoin('ref_plant_species', {
        'indicator_plant.plant_species_id': 'ref_plant_species.id',
      })
      .where(where)
      .orderBy('indicator_plant.created_at', 'asc');

    return results.map((row) => new IndicatorPlant(row, db));
  }
}
