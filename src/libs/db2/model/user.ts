import { sql } from 'kysely';
import { SSO_ROLE_MAP } from '../../../constants.js';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class User extends KyselyModel {
  declare id: number;
  declare username: string;
  declare givenName: string | null;
  declare familyName: string | null;
  declare email: string | null;
  declare phoneNumber: string | null;
  declare active: boolean | null;
  declare piaSeen: boolean | null;
  declare lastLoginAt: Date | null;
  declare ssoId: string | null;
  declare roleId: number | null;
  roles: string[] = [];
  permissions: { id: number }[] = [];
  clientNumber: string | null = null;

  static get fields(): string[] {
    return [
      'id',
      'username',
      'given_name',
      'family_name',
      'email',
      'phone_number',
      'active',
      'pia_seen',
      'last_login_at',
      'sso_id',
      'role_id',
    ];
  }

  static get table(): string {
    return 'user_account';
  }

  static mapRow(row: Record<string, any>): Record<string, any> {
    return {
      id: row.id,
      username: row.username,
      givenName: row.given_name,
      familyName: row.family_name,
      email: row.email,
      piaSeen: row.pia_seen,
      active: row.active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      clientNumber: row.client_number,
      phoneNumber: row.phone_number,
      ssoId: row.sso_id,
      roleId: row.role_id,
    };
  }

  static async find(_db: any, where: Record<string, any>, order?: [string, string]) {
    const hasEmptyIn = Object.values(where).some((v) => Array.isArray(v) && v.length === 0);
    if (hasEmptyIn) {
      return [];
    }

    let query: any = kyselyDb.selectFrom('user_account').selectAll();

    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });

    if (order) {
      query = query.orderBy(order[0], order[1] || 'asc');
    }

    const results = await query.execute();
    return results.map((row: any) => new User(row));
  }

  static async update(_db: any, where: Record<string, any>, values: Record<string, any>) {
    const obj: Record<string, any> = {};
    Object.keys(values).forEach((key) => {
      obj[User.toSnakeCase(key)] = values[key];
    });

    const result: any = await (kyselyDb as any)
      .updateTable('user_account')
      .set(obj)
      .where((eb: any) => {
        const conditions = Object.entries(where).map(([k, v]) => eb(k, '=', v));
        return conditions.reduce((acc: any, c: any) => acc.and(c));
      })
      .returningAll()
      .executeTakeFirst();

    if (result) {
      const row = await kyselyDb
        .selectFrom('user_account')
        .select('id')
        .where((eb: any) => {
          const conditions = Object.entries(where).map(([k, v]) => eb(k, '=', v));
          return conditions.reduce((acc: any, c: any) => acc.and(c));
        })
        .executeTakeFirst();

      if (row?.id) {
        const rows: any = await sql`
          SELECT user_account.*, ref_client.client_number FROM user_account
          LEFT JOIN user_client_link ON user_client_link.user_id = user_account.id
          LEFT JOIN ref_client ON ref_client.client_number = user_client_link.client_id
          WHERE user_account.id = ${row.id}
        `.execute(kyselyDb);

        return User.mapRow(rows.rows[0]);
      }
    }

    return undefined;
  }

  static async findWithExclusion(_db: any, where: Record<string, any>, order: string, _exclude: any) {
    let q: any = (kyselyDb as any).selectFrom('user_account').select('id');
    const conditions = Object.entries(where);
    if (conditions.length > 0) {
      q = q.where((eb: any) => {
        const mapped = conditions.map(([k, v]) => eb(k, '=', v));
        return mapped.reduce((acc: any, c: any) => acc.and(c));
      });
    }
    const results = await q.execute();
    const userIds = results.map((obj: any) => obj.id);
    if (userIds.length === 0) return [];

    let orderClause: any = sql`ORDER BY user_account.id`;
    if (order.length > 0) {
      const col = sql.ref(order[0]);
      const dir = sql.raw(order[1]);
      orderClause = sql`ORDER BY user_account.id, ${col} ${dir}`;
    }

    const res: any = await sql`
      SELECT DISTINCT ON (user_account.id) user_id, user_account.*, ref_client.client_number FROM user_account
      LEFT JOIN user_client_link ON user_client_link.user_id = user_account.id
      LEFT JOIN ref_client ON ref_client.client_number = user_client_link.client_id
      WHERE user_account.id IN (${sql.join(userIds)})
      ${orderClause}
    `.execute(kyselyDb);

    return res.rows.map(User.mapRow);
  }

  async getLinkedClientNumbers(_db?: any) {
    const clientLinks: any[] = await (kyselyDb as any)
      .selectFrom('user_client_link')
      .selectAll()
      .where('user_id', '=', this.id)
      .where('active', '=', true)
      .where('type', '=', 'owner')
      .execute();

    return clientLinks.map((clientLink: any) => clientLink.client_id);
  }

  static async fromClientId(_db: any, clientId: string) {
    const result: any = await (kyselyDb as any)
      .selectFrom('user_account')
      .innerJoin('user_client_link', (join: any) => join.onRef('user_client_link.user_id', '=', 'user_account.id'))
      .selectAll('user_account')
      .where('user_client_link.client_id', '=', clientId)
      .executeTakeFirst();
    return result || [];
  }

  static async getAgentsFromAgreementId(db: any, agreementId: string) {
    const result = await db
      .selectFrom('user_account')
      .innerJoin('client_agreement', (join: any) => join.onRef('client_agreement.agent_id', '=', 'user_account.id'))
      .selectAll('user_account')
      .where('client_agreement.agreement_id', '=', agreementId)
      .execute();
    return result || [];
  }

  isActive(): boolean {
    if (this.active && Object.values(SSO_ROLE_MAP).some((item) => this.roles?.includes(item as string))) {
      return true;
    }
    return false;
  }

  async canAccessAgreement(db: any, agreement: any): Promise<boolean> {
    if (!db || !agreement) {
      return false;
    }

    if (this.isAdministrator() || this.canReadAll()) {
      return true;
    }

    if (this.isAgreementHolder()) {
      const clientIds = await this.getLinkedClientNumbers(db);

      const result = await db
        .selectFrom('client_agreement')
        .select(sql<number>`count(*)`.as('count'))
        .where((eb: any) => {
          const ors: any[] = [
            eb.and([
              eb('client_agreement.agent_id', '=', this.id),
              eb('client_agreement.agreement_id', '=', agreement.forestFileId),
            ]),
          ];
          if (clientIds.length > 0) {
            ors.unshift(
              eb.and([
                eb('client_agreement.client_id', 'in', clientIds),
                eb('client_agreement.agreement_id', '=', agreement.forestFileId),
              ]),
            );
          }
          return eb.or(ors);
        })
        .executeTakeFirst();
      const count = Number(result?.count || 0);
      return count !== 0;
    }

    if (this.isRangeOfficer() || this.isReadOnly()) {
      const result = await db
        .selectFrom('agreement')
        .innerJoin('ref_zone', (join: any) => join.onRef('agreement.zone_id', '=', 'ref_zone.id'))
        .innerJoin('ref_district', (join: any) => join.onRef('ref_zone.district_id', '=', 'ref_district.id'))
        .select(sql<number>`count(*)`.as('count'))
        .where((eb: any) =>
          eb.and([
            eb('ref_zone.district_id', '=', sql`ref_district.id`),
            eb('agreement.forest_file_id', '=', agreement.forestFileId),
          ]),
        )
        .executeTakeFirst();
      const count = Number(result?.count || 0);
      return count !== 0;
    }

    if (this.isDecisionMaker()) {
      const result = await db
        .selectFrom('agreement')
        .selectAll('agreement')
        .distinctOn('agreement.forest_file_id')
        .leftJoin('ref_zone', 'agreement.zone_id', 'ref_zone.id')
        .leftJoin('ref_district', 'ref_zone.district_id', 'ref_district.id')
        .leftJoin('user_districts', 'user_districts.id', 'ref_district.id')
        .where('user_districts.user_id', '=', this.id)
        .where('agreement.forest_file_id', '=', agreement.forestFileId)
        .orderBy('agreement.forest_file_id', 'asc')
        .execute();
      return result.length > 0;
    }

    return false;
  }

  isAdministrator(): boolean {
    return !!this.roleId && this.roleId === 1;
  }

  isDecisionMaker(): boolean {
    return !!this.roleId && this.roleId === 2;
  }

  isRangeOfficer(): boolean {
    return !!this.roleId && this.roleId === 3;
  }

  isAgreementHolder(): boolean {
    return !!this.roleId && this.roleId === 4;
  }

  isReadOnly(): boolean {
    return !!this.roleId && this.roleId === 5;
  }

  canReadAll(): boolean {
    return !!(this.permissions && this.permissions.find((p) => p.id === 1));
  }

  canReadZone(): boolean {
    return !!(this.permissions && this.permissions.find((p) => p.id === 2));
  }

  canReadDistrict(): boolean {
    return !!(this.permissions && this.permissions.find((p) => p.id === 3));
  }
}
