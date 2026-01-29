'use strict';
import { flatten } from 'lodash';
import AgreementType from './agreementtype';
import Client from './client';
import District from './district';
import LivestockIdentifier from './livestockidentifier';
import Model from './model';
import Plan from './plan';
import PlanStatus from './planstatus';
import Usage from './usage';
import User from './user';
import Zone from './zone';
import { AGREEMENT_EXEMPTION_STATUS, PLAN_EXTENSION_STATUS, EXEMPTION_STATUS, PLAN_STATUS } from '../../../constants';
import AgreementExemptionStatus from './agreementexemptionstatus';

export default class Agreement extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Agreement.fields.indexOf(`${Agreement.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });
    super(obj, db);
    this.zone = new Zone(Zone.extract(data), db);
    this.zone.district = new District(District.extract(data), db);
    this.zone.user = new User(User.extract(data), db);
    this.agreementType = new AgreementType(AgreementType.extract(data), db);
    this.agreementExemptionStatus = new AgreementExemptionStatus(AgreementExemptionStatus.extract(data), db);
    this.exemptionStatus = data.exemption_status;
    this.isGrazingSchedule = Agreement.isGrazingSchedule(this);
    this.isHayCuttingSchedule = Agreement.isHayCuttingSchedule(this);
    if (data.plan_id) {
      this.plan = new Plan(Plan.extract(data), db);
      this.plan.status = new PlanStatus(PlanStatus.extract(data), db);
    } else {
      this.plan = null;
    }
  }

  // To matche previous Agreement (sequelize) schema.
  get id() {
    return this.forestFileId;
  }

  static get fields() {
    // primary key *must* be first!
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
    ].map((f) => `${Agreement.table}.${f}`);
  }

  static get table() {
    return 'agreement';
  }

  static isHayCuttingSchedule(agreement) {
    return agreement?.agreementType && (agreement.agreementType.id === 3 || agreement.agreementType.id === 4);
  }

  static isGrazingSchedule(agreement) {
    return agreement?.agreementType && (agreement.agreementType.id === 1 || agreement.agreementType.id === 2);
  }

  static getUsageStatusText(status) {
    switch (status) {
      case 0:
        return 'No Use';
      case 1:
        return 'Over Use';
      default:
        return 'Normal';
    }
  }

  static getExemptionStatusText(status) {
    switch (status) {
      case AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED:
        return 'Not Exempted';
      case AGREEMENT_EXEMPTION_STATUS.ACTIVE:
        return 'Active';
      case AGREEMENT_EXEMPTION_STATUS.SCHEDULED:
        return 'Scheduled';
      default:
        return 'Unknown';
    }
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

  static async findWithAllRelations(db, where, filterSettings, sendFullPlan) {
    let promises = [];
    const myAgreements = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);
    promises = myAgreements.map(async (agreement) => [await agreement.eagerloadAllOneToManyExceptPlan()]);
    await Promise.all(flatten(promises));
    if (sendFullPlan) {
      myAgreements.forEach(async (agreement) => {
        await agreement.plan?.eagerloadAllOneToMany();
      });
      await Promise.all(promises);
    }

    return flatten(myAgreements);
  }

  static async findWithTypeZoneDistrictExemption(
    db,
    where,
    filterSettings = {
      orderBy: 'plan.agreement_id',
      order: 'asc',
      columnFilters: [],
    },
  ) {
    if (!db || !where) {
      return [];
    }
    const myFields = [
      ...Agreement.fields,
      ...Zone.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...District.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...AgreementType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...AgreementExemptionStatus.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...Plan.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...PlanStatus.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];
    let results = [];
    const q = db
      .select(myFields)
      .from(Agreement.table)
      .leftJoin('plan', {
        'agreement.forest_file_id': 'plan.agreement_id',
      })
      .leftJoin('ref_plan_status', {
        'plan.status_id': 'ref_plan_status.id',
      })
      .leftJoin('agreement_exemption_status', {
        'agreement.exemption_status': 'agreement_exemption_status.code',
      })
      .leftJoin('ref_zone', { 'agreement.zone_id': 'ref_zone.id' })
      .leftJoin('ref_district', { 'ref_zone.district_id': 'ref_district.id' })
      .leftJoin('user_account', { 'ref_zone.user_id': 'user_account.id' })
      .leftJoin('user_account as plan_creator', {
        'plan.creator_id': 'plan_creator.id',
      })
      .leftJoin('client_agreement', {
        'agreement.forest_file_id': 'client_agreement.agreement_id',
        'client_agreement.client_type_id': 1,
      })
      .leftJoin('ref_client as agreement_holder', {
        'agreement_holder.client_number': 'client_agreement.client_id',
      })
      .leftJoin('ref_agreement_type', {
        'agreement.agreement_type_id': 'ref_agreement_type.id',
      });

    q.orderByRaw(
      `${filterSettings.orderBy} ${filterSettings.order === 'asc' ? 'asc nulls last' : 'desc nulls first'} 
    ${filterSettings.orderBy === 'extension_status' ? ', CASE WHEN extension_received_votes = extension_required_votes THEN 1 ELSE 0 END desc, extension_required_votes desc' : ''}`,
    );
    if (Object.keys(where).length === 1 && where[Object.keys(where)[0]]?.constructor === Array) {
      const k = Object.keys(where)[0];
      const v = where[k];
      q.whereIn(k, v);
    } else {
      q.where(where);
    }
    q.where(function () {
      this.whereNull('plan.extension_status')
        .orWhereNot({
          'plan.extension_status': PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN,
        })
        .whereNot({
          'plan.extension_status': PLAN_EXTENSION_STATUS.REPLACED_WITH_REPLACEMENT_PLAN,
        });
    });
    const columnFilters = filterSettings.columnFilters;
    Object.keys(columnFilters).map((key) => {
      if (columnFilters[key] && columnFilters[key] !== '') {
        if (key === 'user_account.family_name') {
          q.whereRaw(
            `"user_account"."given_name" || ' ' || "user_account"."family_name" ilike '%${columnFilters[key]}%'`,
          );
        } else if (key === 'plan.plan_end_date') {
          // Can't get entire string with letters and numbers for some reason
          q.whereRaw(`TO_CHAR("plan"."plan_end_date", 'Month DD, YYYY') ilike '%${columnFilters[key]}%'`);
        } else if (key === 'plan.status_id') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            q.whereIn('ref_plan_status.code', columnFilters[key]);
          }
        } else if (key === 'agreement.usage_status') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            q.whereIn('agreement.usage_status', columnFilters[key]);
          }
        } else if (key === 'agreement.has_current_schedule') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            const lowerKey = columnFilters[key].toLowerCase();
            q.where('agreement.has_current_schedule', lowerKey === 'y' ? 1 : lowerKey === 'n' ? 0 : null);
          }
        } else if (key === 'agreement.agreement_exemption_status_id') {
          if (columnFilters[key] && columnFilters[key].length > 0) {
            q.whereIn('agreement_exemption_status.id', columnFilters[key]);
          }
        } else if (key === 'agreement.percentage_use') {
          // Handle numeric comparison operators for percentage_use
          const filterValue = columnFilters[key].toString().trim();
          const lowerFilterValue = filterValue.toLowerCase();

          // Helper function to parse operator and value from a string
          const parseCondition = (conditionStr) => {
            const trimmed = conditionStr.trim();
            const operators = ['!=', '>=', '<=', '>', '<', '='];

            for (const op of operators) {
              if (trimmed.startsWith(op)) {
                const valueStr = trimmed.startsWith(op + ' ')
                  ? trimmed.substring(op.length + 1)
                  : trimmed.substring(op.length);
                const value = parseFloat(valueStr);
                if (!isNaN(value)) {
                  return { operator: op, value: value };
                }
              }
            }

            // If no operator found but it's a valid number, treat as equals
            const numValue = parseFloat(trimmed);
            if (!isNaN(numValue) && !trimmed.includes(' ')) {
              return { operator: '=', value: numValue };
            }

            return null;
          };

          // Helper function to apply condition to query
          const applyCondition = (queryBuilder, condition, useOr = false) => {
            if (!condition) return;
            const method = useOr ? 'orWhere' : 'where';
            queryBuilder[method]('agreement.percentage_use', condition.operator, condition.value);
          };

          if (lowerFilterValue.includes(' and ')) {
            // Handle "and" conditions: ">10 and <50" (case-insensitive)
            const parts = filterValue.split(/ and /i);
            parts.forEach((part) => {
              const condition = parseCondition(part);
              applyCondition(q, condition);
            });
          } else if (lowerFilterValue.includes(' or ')) {
            // Handle "or" conditions: "<10 or >90" (case-insensitive)
            const parts = filterValue.split(/ or /i);
            q.where(function () {
              parts.forEach((part, index) => {
                const condition = parseCondition(part);
                applyCondition(this, condition, index > 0);
              });
            });
          } else {
            // Handle single condition: ">223.66", "=100", "223.66" etc.
            const condition = parseCondition(filterValue);
            applyCondition(q, condition);
          }
        } else {
          q.where(key, 'ilike', `%${columnFilters[key]}%`);
        }
      }
    });
    if (filterSettings.agreementCheck === true) {
      q.where('agreement.retired', 'false');
    }
    if (filterSettings.planCheck === true) {
      q.whereNotNull('ref_plan_status.code');
    }

    if (filterSettings.dmActionableOnly === true) {
      q.where(function () {
        this.whereIn('ref_plan_status.code', [
          PLAN_STATUS.RECOMMEND_READY,
          PLAN_STATUS.RECOMMEND_NOT_READY,
          PLAN_STATUS.STANDS_REVIEW,
        ])
          .orWhere('plan.extension_status', PLAN_EXTENSION_STATUS.AWAITING_EXTENSION)
          .orWhere('plan.extension_status', PLAN_EXTENSION_STATUS.AWAITING_EXTENSION)
          .orWhereExists(function () {
            this.select('*')
              .from('exemption')
              .whereRaw('exemption.agreement_id = agreement.forest_file_id')
              .where('exemption.status', EXEMPTION_STATUS.PENDING_APPROVAL);
          });
      });
    }

    // Define the active plan status condition once to avoid duplication
    const activePlanStatusCondition = `(
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
      q.whereRaw(activePlanStatusCondition);
    }
    if (filterSettings.missingRUP === true) {
      q.where(function () {
        this.whereNull('plan.id').orWhereNull('ref_plan_status.id').orWhereRaw(`NOT ${activePlanStatusCondition}`);
      });
    }
    if (filterSettings.page && filterSettings.limit) {
      const offset = filterSettings.limit * (filterSettings.page - 1);
      results = await q.offset(offset).limit(filterSettings.limit);
    } else {
      results = await q;
    }
    // console.debug(q.toSQL().toNative());
    return results.map((row) => new Agreement(row, db));
  }

  static async agreementsForClientId(db, clientId) {
    if (!db || !clientId) {
      return [];
    }

    const results = await db.select('agreement_id').from('client_agreement').where({ client_id: clientId });

    return flatten(results.map((result) => Object.values(result)));
  }

  static async agreementsForZoneId(db, zoneId) {
    if (!db || !zoneId) {
      return [];
    }

    const results = await db.select('forest_file_id').from(Agreement.table).where({ zone_id: zoneId });

    return flatten(results.map((result) => Object.values(result)));
  }

  static async searchForTerm(db, term) {
    if (!db || !term) {
      return [];
    }

    const results = await db
      .select(Agreement.primaryKey)
      .from(Agreement.table)
      .where({ 'agreement.forest_file_id': term })
      .orWhere('agreement.forest_file_id', 'ilike', `%${term}%`);

    // return an array of `forest_file_id`
    return flatten(results.map((result) => Object.values(result)));
  }

  static async retireAgreements(db, activeFTAAgreementIds) {
    const results = await db
      .table(Agreement.table)
      .whereNotIn('forest_file_id', activeFTAAgreementIds)
      .where('forest_file_id', 'not like', 'RAN099%')
      .update({ retired: true })
      .returning(this.primaryKey);
    await db
      .table(Plan.table)
      .whereNotIn('agreement_id', activeFTAAgreementIds)
      .where('agreement_id', 'not like', 'RAN099%')
      .update({ status_id: 25 });
    return results;
  }

  async eagerloadAllOneToManyExceptPlan() {
    await this.fetchClients();
    await this.fetchUsage();
    await this.fetchLivestockIdentifiers();
    await this.plan?.fetchExtensionRequests();
  }

  async fetchClients() {
    const clients = await Client.clientsForAgreement(this.db, this);
    this.clients = clients;
  }

  async fetchUsage() {
    const order = ['year', 'asc'];
    const where = { agreement_id: this.forestFileId };
    const usage = await Usage.find(this.db, where, order);
    this.usage = usage;
  }

  async fetchLivestockIdentifiers() {
    const where = { agreement_id: this.forestFileId };
    const livestockIdentifiers = await LivestockIdentifier.findWithTypeLocation(this.db, where);
    this.livestockIdentifiers = livestockIdentifiers;
  }

  // Transform the client property to match the API v1 specification.
  transformToV1() {
    if (!this.clients && this.clients.length === 0) {
      return;
    }

    Object.defineProperty(this, 'id', {
      enumerable: true,
      value: this.forestFileId,
      writable: false,
    });

    const clients = this.clients.map((client) => {
      const aClient = {
        id: client.clientNumber,
        locationCodes: client.locationCodes,
        name: client.name,
        clientTypeCode: client.clientType.code,
        startDate: client.licenseeStartDate,
        endDate: client.licenseeEndDate,
      };

      return aClient;
    });

    this.clients = clients.sort((a, b) => a.clientTypeCode > b.clientTypeCode);
  }
}
