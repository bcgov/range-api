import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import Client from './client.js';
import Usage from './usage.js';
import LivestockIdentifier from './livestockidentifier.js';
import PlanExtensionRequests from './planextensionrequests.js';
import Plan from './plan.js';
import {
  AGREEMENT_EXEMPTION_STATUS,
  PLAN_EXTENSION_STATUS,
  EXEMPTION_STATUS,
  PLAN_STATUS,
  SYSTEM_USER_ID,
} from '../../../constants.js';

export default class Agreement extends KyselyModel {
  declare forestFileId: string;
  declare agreementStartDate: string;
  declare agreementEndDate: string;
  declare zoneId: number;
  declare agreementTypeId: number;
  declare retired: boolean;
  declare usageStatus: number;
  declare percentageUse: number;
  declare hasCurrentSchedule: boolean;
  declare exemptionStatus: number;
  declare usage_status: number;
  declare percentage_use: number;
  declare _db: any;
  declare zone: any;
  declare agreementType: any;
  declare agreementExemptionStatus: any;
  declare isGrazingSchedule: boolean;
  declare isHayCuttingSchedule: boolean;
  declare plan: any;
  clients: any[] | null = null;
  usage: any[] | null = null;
  livestockIdentifiers: any[] | null = null;

  constructor(data: Record<string, any>, db: any = undefined) {
    super(data, db);
    this._db = db;

    this.zone = data.ref_zone_id
      ? {
          id: data.ref_zone_id,
          code: data.ref_zone_code,
          description: data.ref_zone_description,
          districtId: data.ref_zone_district_id,
          district: data.ref_district_id
            ? {
                id: data.ref_district_id,
                code: data.ref_district_code,
                description: data.ref_district_description,
              }
            : null,
          user: data.user_account_id
            ? {
                id: data.user_account_id,
                username: data.user_account_username,
                givenName: data.user_account_given_name,
                familyName: data.user_account_family_name,
                email: data.user_account_email,
              }
            : null,
        }
      : null;

    this.agreementType = data.ref_agreement_type_id
      ? {
          id: data.ref_agreement_type_id,
          code: data.ref_agreement_type_code,
          description: data.ref_agreement_type_description,
        }
      : null;

    this.agreementExemptionStatus = data.agreement_exemption_status_id
      ? {
          id: data.agreement_exemption_status_id,
          code: data.agreement_exemption_status_code,
          description: data.agreement_exemption_status_description,
        }
      : null;

    this.exemptionStatus = data.exemption_status;
    this.isGrazingSchedule = Agreement.isGrazingSchedule(this);
    this.isHayCuttingSchedule = Agreement.isHayCuttingSchedule(this);

    if (data.plan_id) {
      this.plan = {
        id: data.plan_id,
        agreementId: data.plan_agreement_id,
        statusId: data.plan_status_id,
        rangeName: data.plan_range_name,
        planStartDate: data.plan_plan_start_date,
        planEndDate: data.plan_plan_end_date,
        status: data.ref_plan_status_id
          ? {
              id: data.ref_plan_status_id,
              code: data.ref_plan_status_code,
              name: data.ref_plan_status_name,
              description: data.ref_plan_status_description,
            }
          : null,
        extensionStatus: data.plan_extension_status,
        extensionRequiredVotes: data.plan_extension_required_votes,
        extensionReceivedVotes: data.plan_extension_received_votes,
      };
    } else {
      this.plan = null;
    }
  }

  get id() {
    return this.forestFileId;
  }

  static get fields(): string[] {
    return [
      'forest_file_id',
      'agreement_start_date',
      'agreement_end_date',
      'zone_id',
      'agreement_type_id',
      'retired',
      'usage_status',
      'percentage_use',
      'has_current_schedule',
      'exemption_status',
    ];
  }

  static get table(): string {
    return 'agreement';
  }

  static isHayCuttingSchedule(agreement: any) {
    return !!(agreement?.agreementType && (agreement.agreementType.id === 3 || agreement.agreementType.id === 4));
  }

  static isGrazingSchedule(agreement: any) {
    return !!(agreement?.agreementType && (agreement.agreementType.id === 1 || agreement.agreementType.id === 2));
  }

  static getUsageStatusText(status: number) {
    switch (status) {
      case 0:
        return 'No Use';
      case 1:
        return 'Over Use';
      default:
        return 'Normal';
    }
  }

  static getExemptionStatusText(status: any) {
    switch (status) {
      case AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED:
        return 'Not Exempted';
      case AGREEMENT_EXEMPTION_STATUS.IN_PROGRESS:
        return 'In Progress';
      case AGREEMENT_EXEMPTION_STATUS.EXEMPTED:
        return 'Exempted';
      case AGREEMENT_EXEMPTION_STATUS.SCHEDULED:
        return 'Scheduled';
      default:
        return 'Unknown';
    }
  }

  static getLicenseTypeText(agreement: any) {
    if (Agreement.isHayCuttingSchedule(agreement)) {
      return 'Hay Cutting Licence';
    }
    if (Agreement.isGrazingSchedule(agreement)) {
      return 'Grazing Licence';
    }
    return '';
  }

  get usageStatusText() {
    return Agreement.getUsageStatusText(this.usage_status);
  }

  get isNoUse() {
    return this.usage_status === 0;
  }

  get isOverUse() {
    return this.usage_status === 1;
  }

  get percentageUseAmount() {
    return this.percentage_use || 0;
  }

  get hasOverUse() {
    return this.percentage_use && this.percentage_use > 0;
  }

  static async findWithAllRelations(db: any, where: any, filterSettings: any, sendFullPlan: any) {
    const myAgreements = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);
    const promises = myAgreements.map(async (agreement: any) => [await agreement.eagerloadAllOneToManyExceptPlan()]);
    await Promise.all(promises.flat());
    if (sendFullPlan) {
      const planPromises = myAgreements.map(async (agreement: any) => {
        if (agreement.plan) {
          const instance = await Plan.findById(db, agreement.plan.id);
          await instance.eagerloadAllOneToMany();
          agreement.plan = instance;
        }
      });
      await Promise.all(planPromises);
    }

    return myAgreements.flat();
  }

  static async findWithTypeZoneDistrictExemption(
    db: any,
    where: any,
    filterSettings: any = {
      orderBy: 'plan.agreement_id',
      order: 'asc',
      columnFilters: [],
    },
  ) {
    if (!where) {
      return [];
    }

    const agreementSelect = [
      'agreement.forest_file_id',
      'agreement.agreement_start_date',
      'agreement.agreement_end_date',
      'agreement.zone_id',
      'agreement.agreement_type_id',
      'agreement.retired',
      'agreement.usage_status',
      'agreement.percentage_use',
      'agreement.has_current_schedule',
      'agreement.exemption_status',
    ];

    let query: any = (kyselyDb as any)
      .selectFrom('agreement')
      .select(agreementSelect)
      .select([
        'ref_zone.id as ref_zone_id',
        'ref_zone.code as ref_zone_code',
        'ref_zone.description as ref_zone_description',
        'ref_zone.district_id as ref_zone_district_id',
        'ref_district.id as ref_district_id',
        'ref_district.code as ref_district_code',
        'ref_district.description as ref_district_description',
        'user_account.id as user_account_id',
        'user_account.username as user_account_username',
        'user_account.given_name as user_account_given_name',
        'user_account.family_name as user_account_family_name',
        'user_account.email as user_account_email',
        'agreement_exemption_status.id as agreement_exemption_status_id',
        'agreement_exemption_status.code as agreement_exemption_status_code',
        'agreement_exemption_status.description as agreement_exemption_status_description',
        'ref_agreement_type.id as ref_agreement_type_id',
        'ref_agreement_type.code as ref_agreement_type_code',
        'ref_agreement_type.description as ref_agreement_type_description',
        'plan.id as plan_id',
        'plan.agreement_id as plan_agreement_id',
        'plan.status_id as plan_status_id',
        'plan.range_name as plan_range_name',
        'plan.plan_start_date as plan_plan_start_date',
        'plan.plan_end_date as plan_plan_end_date',
        'plan.extension_status as plan_extension_status',
        'plan.extension_required_votes as plan_extension_required_votes',
        'plan.extension_received_votes as plan_extension_received_votes',
        'ref_plan_status.id as ref_plan_status_id',
        'ref_plan_status.code as ref_plan_status_code',
        'ref_plan_status.name as ref_plan_status_name',
        'ref_plan_status.description_full as ref_plan_status_description',
      ])
      .leftJoin('plan', 'plan.agreement_id', 'agreement.forest_file_id')
      .leftJoin('ref_plan_status', 'plan.status_id', 'ref_plan_status.id')
      .leftJoin('agreement_exemption_status', 'agreement.exemption_status', 'agreement_exemption_status.code')
      .leftJoin('ref_zone', 'agreement.zone_id', 'ref_zone.id')
      .leftJoin('ref_district', 'ref_zone.district_id', 'ref_district.id')
      .leftJoin('user_account', 'ref_zone.user_id', 'user_account.id')
      .leftJoin('ref_agreement_type', 'agreement.agreement_type_id', 'ref_agreement_type.id')
      .leftJoin(
        sql`(SELECT ca.agreement_id, rc.name FROM client_agreement ca INNER JOIN ref_client rc ON ca.client_id = rc.client_number INNER JOIN ref_client_type rct ON ca.client_type_id = rct.id WHERE rct.code = 'A') as primary_ah`,
        'primary_ah.agreement_id',
        'agreement.forest_file_id',
      );

    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) {
          query = query.where(k, 'in', v);
        }
      } else if (v !== undefined) {
        query = query.where(k, '=', v);
      }
    });

    query = query.where((eb: any) =>
      eb.or([
        eb('plan.extension_status', 'is', null),
        eb.and([
          eb('plan.extension_status', '!=', PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN),
          eb('plan.extension_status', '!=', PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN),
        ]),
      ]),
    );

    const columnFilters = filterSettings.columnFilters || {};
    Object.keys(columnFilters).forEach((key) => {
      if (columnFilters[key] && columnFilters[key] !== '') {
        if (key === 'user_account.family_name') {
          query = query.where(
            sql`"user_account"."given_name" || ' ' || "user_account"."family_name"`,
            'ilike',
            `%${columnFilters[key]}%`,
          );
        } else if (key === 'plan.plan_end_date') {
          query = query.where(
            sql`TO_CHAR("plan"."plan_end_date", 'Month DD, YYYY')`,
            'ilike',
            `%${columnFilters[key]}%`,
          );
        } else if (key === 'plan.status_id') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            query = query.where('ref_plan_status.code', 'in', columnFilters[key]);
          }
        } else if (key === 'agreement.usage_status') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            query = query.where('agreement.usage_status', 'in', columnFilters[key]);
          }
        } else if (key === 'agreement.has_current_schedule') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            const lowerKey = columnFilters[key].toLowerCase();
            query = query.where(
              'agreement.has_current_schedule',
              '=',
              lowerKey === 'y' ? 1 : lowerKey === 'n' ? 0 : null,
            );
          }
        } else if (key === 'agreement.exemption_status') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            query = query.where('agreement_exemption_status.code', 'in', columnFilters[key]);
          }
        } else if (key === 'agreement.percentage_use') {
          const filterValue = columnFilters[key].toString().trim();
          const lowerFilterValue = filterValue.toLowerCase();

          const parseCondition = (conditionStr: string) => {
            const trimmed = conditionStr.trim();
            const operators = ['!=', '>=', '<=', '>', '<', '='];

            for (const op of operators) {
              if (trimmed.startsWith(op)) {
                const valueStr = trimmed.startsWith(op + ' ')
                  ? trimmed.substring(op.length + 1)
                  : trimmed.substring(op.length);
                const value = parseFloat(valueStr);
                if (!isNaN(value)) {
                  return { operator: op, value };
                }
              }
            }

            const numValue = parseFloat(trimmed);
            if (!isNaN(numValue) && !trimmed.includes(' ')) {
              return { operator: '=', value: numValue };
            }

            return null;
          };

          const applyCondition = (q: any, condition: any) => {
            if (!condition) return q;
            return q.where('agreement.percentage_use', condition.operator, condition.value);
          };

          if (lowerFilterValue.includes(' and ')) {
            const parts = filterValue.split(/ and /i);
            parts.forEach((part: string) => {
              const condition = parseCondition(part);
              query = applyCondition(query, condition);
            });
          } else if (lowerFilterValue.includes(' or ')) {
            const parts = filterValue.split(/ or /i);
            const conditions = parts.map((part: string) => parseCondition(part)).filter(Boolean);
            if (conditions.length > 0) {
              query = query.where((eb: any) => {
                const ors = conditions.map((c: any) => eb('agreement.percentage_use', c.operator, c.value));
                return ors.reduce((acc: any, c: any) => acc.or(c));
              });
            }
          } else {
            const condition = parseCondition(filterValue);
            query = applyCondition(query, condition);
          }
        } else if (key === 'agreement_holder.name') {
          query = query.where('primary_ah.name', 'ilike', `%${columnFilters[key]}%`);
        } else {
          query = query.where(key, 'ilike', `%${columnFilters[key]}%`);
        }
      }
    });

    if (filterSettings.agreementCheck === true) {
      query = query.where('agreement.retired', '=', false);
    }
    if (filterSettings.planCheck === true) {
      query = query.where('ref_plan_status.code', 'is not', null);
    }

    if (filterSettings.dmActionableOnly === true) {
      query = query.where((eb: any) =>
        eb.or([
          eb('ref_plan_status.code', 'in', [
            PLAN_STATUS.RECOMMEND_READY,
            PLAN_STATUS.RECOMMEND_NOT_READY,
            PLAN_STATUS.STANDS_REVIEW,
          ]),
          eb('plan.extension_status', '=', PLAN_EXTENSION_STATUS.AWAITING_EXTENSION),
          eb.exists(
            (kyselyDb as any)
              .selectFrom('exemption')
              .selectAll()
              .whereRef('exemption.agreement_id', '=', 'agreement.forest_file_id')
              .where('exemption.status', '=', EXEMPTION_STATUS.PENDING_APPROVAL),
          ),
        ]),
      );
    }

    const activePlanStatusCondition = sql`(
      "ref_plan_status"."id"=8 OR
      "ref_plan_status"."id"=9 OR
      "ref_plan_status"."id"=12 OR
      "ref_plan_status"."id"=20 OR
      "ref_plan_status"."id"=21 OR
      "ref_plan_status"."id"=22 OR
      (
        "plan"."amendment_type_id" IS NOT NULL
        AND (
           "ref_plan_status"."id"!=26 AND
           "ref_plan_status"."id"!=25
        )
      )
    )`;

    if (filterSettings.activeCheck === true) {
      query = query.where(activePlanStatusCondition);
    }
    if (filterSettings.missingRUP === true) {
      query = query.where((eb: any) =>
        eb.or([eb('plan.id', 'is', null), eb('ref_plan_status.id', 'is', null), eb.not(activePlanStatusCondition)]),
      );
    }

    if (filterSettings.countOnly === true) {
      const countQuery = (kyselyDb as any).selectFrom(query.as('inner')).select(sql`count(*)::int as total`);
      const result = await countQuery.executeTakeFirst();
      return Number(result?.total ?? 0);
    }

    let orderByField = filterSettings.orderBy;
    if (orderByField === 'agreement_holder.name') {
      orderByField = 'primary_ah.name';
    }
    query = query.orderBy(
      sql.raw(
        `${orderByField} ${filterSettings.order === 'asc' ? 'asc nulls last' : 'desc nulls first'}` +
          `${filterSettings.orderBy === 'extension_status' ? ', CASE WHEN extension_received_votes = extension_required_votes THEN 1 ELSE 0 END desc, extension_required_votes desc' : ''}` +
          `, agreement.forest_file_id asc`,
      ),
    );

    if (filterSettings.page && filterSettings.limit) {
      const offset = filterSettings.limit * (filterSettings.page - 1);
      query = query.offset(offset).limit(filterSettings.limit);
    }

    const results = await query.execute();
    return results.map((row: any) => new Agreement(row, db));
  }

  static async agreementsForClientId(db: any, clientId: any) {
    if (!clientId) {
      return [];
    }

    const results = await kyselyDb
      .selectFrom('client_agreement')
      .select('agreement_id')
      .where('client_id', '=', clientId)
      .execute();

    return results.flatMap((result: any) => [result.agreement_id]);
  }

  static async agreementsForZoneId(db: any, zoneId: any) {
    if (!zoneId) {
      return [];
    }

    const results = await kyselyDb
      .selectFrom('agreement')
      .select('forest_file_id')
      .where('zone_id', '=', zoneId)
      .execute();

    return results.flatMap((result: any) => [result.forest_file_id]);
  }

  static async searchForTerm(_db: any, term: any) {
    if (!term) {
      return [];
    }

    const results = await sql`
      SELECT forest_file_id FROM agreement
      WHERE agreement.forest_file_id = ${term}
      OR agreement.forest_file_id ILIKE ${`%${term}%`}
    `.execute(kyselyDb);

    return results.rows.flatMap((row: any) => Object.values(row));
  }

  static async retireAgreements(_db: any, activeFTAAgreementIds: any) {
    await sql`
      UPDATE agreement SET retired = true
      WHERE forest_file_id NOT IN (${sql.join(activeFTAAgreementIds)})
      AND forest_file_id NOT LIKE 'RAN099%'
    `.execute(kyselyDb);

    await sql`
      UPDATE plan SET status_id = 25
      WHERE agreement_id NOT IN (${sql.join(activeFTAAgreementIds)})
      AND agreement_id NOT LIKE 'RAN099%'
    `.execute(kyselyDb);

    return [];
  }

  static async unretireAgreements(_db: any, activeFTAAgreementIds: any) {
    if (!activeFTAAgreementIds || activeFTAAgreementIds.length === 0) {
      return [];
    }

    const agreementsToUnretire = await kyselyDb
      .selectFrom('agreement')
      .select('forest_file_id')
      .where('forest_file_id', 'in', activeFTAAgreementIds)
      .where('retired', '=', true)
      .execute();

    const agreementIds = agreementsToUnretire.map((a: any) => a.forest_file_id);

    if (agreementIds.length === 0) {
      return [];
    }

    await kyselyDb
      .updateTable('agreement')
      .set({ retired: false })
      .where('forest_file_id', 'in', agreementIds)
      .execute();

    const plansToUpdate = await kyselyDb
      .selectFrom('plan')
      .select(['id', 'status_id'])
      .where('agreement_id', 'in', agreementIds)
      .where('status_id', '=', 25)
      .execute();

    for (const plan of plansToUpdate) {
      await kyselyDb.updateTable('plan').set({ status_id: 6 }).where('id', '=', plan.id).execute();

      await (kyselyDb as any)
        .insertInto('plan_status_history')
        .values({
          plan_id: plan.id,
          from_plan_status_id: plan.status_id,
          to_plan_status_id: 6,
          user_id: SYSTEM_USER_ID,
          note: 'Agreement renewed in FTA, unretiring agreement and setting plan to staff draft.',
        })
        .execute();
    }

    return agreementIds;
  }

  static async unretirePlans(_db: any, activeFTAAgreementIds: any) {
    if (!activeFTAAgreementIds || activeFTAAgreementIds.length === 0) {
      return;
    }

    const STAFF_DRAFT_STATUS = 6;
    const RETIRED_STATUS = 25;

    const plansToUnretire = await kyselyDb
      .selectFrom('plan')
      .select(['id', 'status_id', 'agreement_id'])
      .where('agreement_id', 'in', activeFTAAgreementIds)
      .where('status_id', '=', RETIRED_STATUS)
      .where((eb: any) =>
        eb.or([
          eb('extension_status', 'is', null),
          eb('extension_status', 'not in', [
            PLAN_EXTENSION_STATUS.REPLACEMENT_PLAN_CREATED,
            PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
          ]),
        ]),
      )
      .execute();

    for (const plan of plansToUnretire) {
      const lastStatusHistory = await kyselyDb
        .selectFrom('plan_status_history')
        .select('from_plan_status_id')
        .where('plan_id', '=', plan.id)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();

      const previousStatusId = lastStatusHistory?.from_plan_status_id || STAFF_DRAFT_STATUS;

      await kyselyDb.updateTable('plan').set({ status_id: previousStatusId }).where('id', '=', plan.id).execute();

      await (kyselyDb as any)
        .insertInto('plan_status_history')
        .values({
          plan_id: plan.id,
          from_plan_status_id: plan.status_id,
          to_plan_status_id: previousStatusId,
          user_id: SYSTEM_USER_ID,
          note: 'Agreement is active in FTA, unretiring plan and restoring previous status.',
        })
        .execute();
    }
  }

  async eagerloadAllOneToManyExceptPlan() {
    await this.fetchClients();
    await this.fetchUsage();
    await this.fetchLivestockIdentifiers();
    if (this.plan) {
      const requests = await PlanExtensionRequests.findWithExclusion(this._db, { plan_id: this.plan.id });
      this.plan.planExtensionRequests = requests || [];
    }
  }

  async fetchClients() {
    const agreement = { forestFileId: this.forestFileId };
    const clients = await Client.clientsForAgreement(kyselyDb, agreement);
    this.clients = clients;
  }

  async fetchUsage() {
    const order: any = ['year', 'asc'];
    const where = { agreement_id: this.forestFileId };
    const usage = await Usage.find(this._db, where, order);
    this.usage = usage;
  }

  async fetchLivestockIdentifiers() {
    const where = { agreement_id: this.forestFileId };
    const livestockIdentifiers = await LivestockIdentifier.findWithTypeLocation(this._db, where);
    this.livestockIdentifiers = livestockIdentifiers;
  }

  transformToV1() {
    if (!this.clients || this.clients.length === 0) {
      return;
    }

    Object.defineProperty(this, 'id', {
      enumerable: true,
      value: this.forestFileId,
      writable: false,
    });

    const clients = this.clients.map((client: any) => {
      const aClient = {
        id: client.clientNumber,
        locationCodes: client.locationCodes,
        name: client.name,
        clientTypeCode: client.clientType.code,
        startDate: client.licenseeStartDate,
        endDate: client.licenseeEndDate,
        email: client.email,
        userGivenName: client.userGivenName,
        userFamilyName: client.userFamilyName,
      };

      return aClient;
    });

    this.clients = clients.sort((a: any, b: any) => (a.clientTypeCode > b.clientTypeCode ? 1 : -1));
  }
}
