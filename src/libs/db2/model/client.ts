import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class Client extends KyselyModel {
  declare clientNumber: any;
  declare locationCodes: any;
  declare name: any;
  declare licenseeStartDate: any;
  declare licenseeEndDate: any;
  clientType: any = null;
  email: any = '';
  userGivenName: any = '';
  userFamilyName: any = '';

  constructor(data: Record<string, any>, _db?: any) {
    super(data, _db);
    this.clientType = data.ref_client_type_code
      ? {
          id: data.ref_client_type_id,
          code: data.ref_client_type_code,
          description: data.ref_client_type_description,
          active: data.ref_client_type_active,
        }
      : null;
    this.email = data.user_email || '';
    this.userGivenName = data.user_given_name || '';
    this.userFamilyName = data.user_family_name || '';
  }

  get id() {
    return this.clientNumber;
  }

  static get fields(): string[] {
    return ['client_number', 'location_codes', 'name', 'licensee_start_date', 'licensee_end_date'];
  }

  static get table(): string {
    return 'ref_client';
  }

  static get primaryKey(): string {
    return 'client_number';
  }

  static async clientsForAgreement(_db: any, agreement: any) {
    if (!agreement) {
      return [];
    }

    const results = await (kyselyDb as any)
      .selectFrom('ref_client')
      .selectAll('ref_client')
      .select([
        'ref_client_type.id as ref_client_type_id',
        'ref_client_type.code as ref_client_type_code',
        'ref_client_type.description as ref_client_type_description',
        'ref_client_type.active as ref_client_type_active',
        'user_account.email as user_email',
        'user_account.given_name as user_given_name',
        'user_account.family_name as user_family_name',
      ])
      .innerJoin('client_agreement', 'client_agreement.client_id', 'ref_client.client_number')
      .innerJoin('ref_client_type', 'client_agreement.client_type_id', 'ref_client_type.id')
      .leftJoin('user_client_link', 'user_client_link.client_id', 'ref_client.client_number')
      .leftJoin('user_account', 'user_account.id', 'user_client_link.user_id')
      .where('client_agreement.agreement_id', '=', agreement.forestFileId)
      .execute();

    return results.map((row: Record<string, any>) => new Client(row));
  }

  static async searchForTerm(_db: any, term: string) {
    if (!term) {
      return [];
    }

    const results: any = await sql`
      SELECT client_number FROM ref_client WHERE name ILIKE ${`%${term}%`}
    `.execute(kyselyDb);

    return results.rows.flatMap((row: Record<string, any>) => Object.values(row));
  }

  static async searchByNameWithAllFields(_db: any, term: string) {
    if (!term) {
      return [];
    }

    const results: any = await sql`
      SELECT * FROM ref_client WHERE name ILIKE ${`%${term}%`}
    `.execute(kyselyDb);

    return results.rows.map((row: Record<string, any>) => new Client(row));
  }
}
