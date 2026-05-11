import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import LivestockIdentifierLocation from './livestockidentifierlocation.js';
import LivestockIdentifierType from './livestockidentifiertype.js';

export default class LivestockIdentifier extends KyselyModel {
  declare location: LivestockIdentifierLocation;
  declare identifierType: LivestockIdentifierType;
  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);

    this.location = new LivestockIdentifierLocation(LivestockIdentifierLocation.extract(data));
    this.identifierType = new LivestockIdentifierType(LivestockIdentifierType.extract(data));
  }

  static get fields(): string[] {
    return ['id', 'image_ref', 'description', 'accepted'];
  }

  static get table(): string {
    return 'livestock_identifier';
  }

  static async findWithTypeLocation(_db: any, where: Record<string, any>) {
    const db = _db || kyselyDb;
    const myFields: any[] = [
      ...LivestockIdentifier.fields.map((f: string) => `livestock_identifier.${f}`),
      ...LivestockIdentifierType.fields.map((f: string) =>
        sql`ref_livestock_identifier_type.${sql.raw(f)}`.as(`ref_livestock_identifier_type_${f}`),
      ),
      ...LivestockIdentifierLocation.fields.map((f: string) =>
        sql`ref_livestock_identifier_location.${sql.raw(f)}`.as(`ref_livestock_identifier_location_${f}`),
      ),
    ];

    let query: any = db
      .selectFrom('livestock_identifier')
      .select(myFields)
      .innerJoin('ref_livestock_identifier_location', (join: any) =>
        join.onRef(
          'livestock_identifier.livestock_identifier_location_id',
          '=',
          'ref_livestock_identifier_location.id',
        ),
      )
      .innerJoin('ref_livestock_identifier_type', (join: any) =>
        join.onRef('livestock_identifier.livestock_identifier_type_id', '=', 'ref_livestock_identifier_type.id'),
      );

    Object.entries(where).forEach(([k, v]) => {
      query = query.where(k, '=', v);
    });

    const results: any = await query.execute();

    return results.map((row: any) => new LivestockIdentifier(row, db));
  }
}
