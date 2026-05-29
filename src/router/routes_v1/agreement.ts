// @ts-nocheck
'use strict';

import { errorWithCode } from '../../libs/bcgov-shim.js';
import { Router } from 'express';
import { dayjs as moment } from '../../libs/bcgov-shim.js';
import { stringify } from 'csv';
import config from '../../config/index.js';
import DataManager from '../../libs/db2/index.js';
import UserDistricts from '../../libs/db2/model/userDistricts.js';
import ExemptionController from '../controllers_v1/ExemptionController.js';
import ExemptionStatusController from '../controllers_v1/ExemptionStatusController.js';
import { AGREEMENT_EXPORT_COLUMNS, AGREEMENT_EXPORT } from '../../constants.js';
import { calculateMaxLivestock } from '../helpers/livestockRequirementCalculator.js';
import LivestockType from '../../libs/db2/model/livestocktype.js';

const router = new Router();

const dm2 = new DataManager(config);
const { db, Agreement, Zone, ClientAgreement } = dm2;

const getAgreeementsForAH = async (user, filterSettings) => {
  const clientIds = await user.getLinkedClientNumbers(db);
  const clientAgreements = await ClientAgreement.find(db, {
    client_id: clientIds,
  });
  const agentClientAgreements = await ClientAgreement.find(db, {
    agent_id: user.id,
  });
  const agreementIds = [...clientAgreements, ...agentClientAgreements].map(
    (clientAgreement) => clientAgreement.agreementId,
  );
  const agreements = await Agreement.findWithAllRelations(
    db,
    {
      forest_file_id: agreementIds,
    },
    filterSettings,
    false,
  );
  return agreements.map((a) => {
    const agreement = a;
    agreement.isAgent = agentClientAgreements.some((ca) => ca.agreementId === a.id);
    return a;
  });
};

const getAgreements = async (user, filterSettings) => {
  let agreements = [];
  if (user.isAgreementHolder()) {
    agreements = await getAgreeementsForAH(user, filterSettings);
  } else if (user.isAdministrator() || user.canReadAll() || user.isRangeOfficer()) {
    if (!(filterSettings?.zoneInfo?.selectedZones?.length === 0)) {
      agreements = await Agreement.findWithAllRelations(
        db,
        { 'ref_zone.id': filterSettings.zoneInfo?.selectedZones },
        filterSettings,
        true,
      );
    }
  } else if (user.isDecisionMaker() || user.canReadDistrict()) {
    const districts = await UserDistricts.find(db, { user_id: user.id });
    const zones = await Zone.find(db, {
      district_id: districts.map((d) => d.id),
    });
    agreements = await Agreement.findWithAllRelations(db, { zone_id: zones.map((z) => z.id) }, filterSettings, false);
  } else {
    throw errorWithCode('Unable to determine user role', 500);
  }

  return agreements;
};

const countAgreements = async (user, filterSettings) => {
  const countSettings = { ...filterSettings, countOnly: true };
  if (user.isAgreementHolder()) {
    const clientIds = await user.getLinkedClientNumbers(db);
    const clientAgreements = await ClientAgreement.find(db, {
      client_id: clientIds,
    });
    const agentClientAgreements = await ClientAgreement.find(db, {
      agent_id: user.id,
    });
    const agreementIds = [...clientAgreements, ...agentClientAgreements].map(
      (clientAgreement) => clientAgreement.agreementId,
    );
    return Agreement.findWithTypeZoneDistrictExemption(db, { forest_file_id: agreementIds }, countSettings);
  }
  if (user.isAdministrator() || user.canReadAll() || user.isRangeOfficer()) {
    if (filterSettings?.zoneInfo?.selectedZones?.length === 0) {
      return 0;
    }
    return Agreement.findWithTypeZoneDistrictExemption(
      db,
      { 'ref_zone.id': filterSettings.zoneInfo?.selectedZones },
      countSettings,
    );
  }
  if (user.isDecisionMaker() || user.canReadDistrict()) {
    const districts = await UserDistricts.find(db, { user_id: user.id });
    const zones = await Zone.find(db, {
      district_id: districts.map((d) => d.id),
    });
    return Agreement.findWithTypeZoneDistrictExemption(db, { zone_id: zones.map((z) => z.id) }, countSettings);
  }
  throw errorWithCode('Unable to determine user role', 500);
};

// Search agreements by RAN, contact name, and client name. This is only used by Web
router.get('/search', async (req, res) => {
  const { user, query } = req;
  const filterSettings = query.filterSettings ? JSON.parse(query.filterSettings) : {};
  const page = Number(filterSettings.page || 0);
  const limit = Number(filterSettings.limit || 10);

  const totalItems = await countAgreements(user, filterSettings);

  const agreements = await getAgreements(user, filterSettings);

  agreements.map((agreement) => agreement.transformToV1());
  const totalPages = Math.ceil(totalItems / limit);
  const currentPage = page > totalPages ? totalPages : page;
  const result = {
    perPage: limit,
    currentPage,
    totalItems,
    totalPages,
    agreements,
  };
  res.status(200).json(result).end();
});

// Export max livestock values as CSV
router.get('/export/livestock', async (req, res) => {
  const { user, query } = req;

  if (!user.isAdministrator() && !user.isRangeOfficer() && !user.isDecisionMaker() && !user.isReadOnly()) {
    throw errorWithCode('Unauthorized', 403);
  }

  const filterSettings = query.filterSettings ? JSON.parse(query.filterSettings) : {};
  const exportSettings = { ...filterSettings, page: null, limit: null };

  let agreements = await getAgreements(user, exportSettings);
  // Filter out test agreements
  agreements = agreements.filter((agreement) => !agreement.forestFileId.startsWith(AGREEMENT_EXPORT.TEST_RAN_PREFIX));
  agreements.map((agreement) => agreement.transformToV1());

  const livestockTypes = await LivestockType.getAllActive(db);

  const csvData = [];
  for (const agreement of agreements) {
    if (agreement.plan && agreement.plan.id) {
      await agreement.plan.fetchSchedules(agreement.agreementType?.id);
      if (agreement.plan.schedules) {
        for (const schedule of agreement.plan.schedules) {
          const maxLivestock = calculateMaxLivestock(schedule.scheduleEntries);

          const row = {
            [AGREEMENT_EXPORT_COLUMNS.RAN]: agreement.forestFileId,
            Year: schedule.year,
          };

          livestockTypes.forEach((type) => {
            const columnName = `${type.name}${AGREEMENT_EXPORT.LIVESTOCK_COLUMN_SUFFIX}`;
            row[columnName] = maxLivestock[type.id] || 0;
          });

          csvData.push(row);
        }
      }
    }
  }

  stringify(csvData, { header: true }, (err, output) => {
    if (err) {
      throw err;
    }
    res.setHeader('Content-Type', AGREEMENT_EXPORT.CONTENT_TYPE);
    res.setHeader('Content-Disposition', 'attachment; filename="livestock_export.csv"');
    res.status(200).send(output);
  });
});

// Export agreements as CSV
router.get('/export', async (req, res) => {
  const { user, query } = req;

  if (!user.isAdministrator() && !user.isRangeOfficer() && !user.isDecisionMaker() && !user.isReadOnly()) {
    throw errorWithCode('Unauthorized', 403);
  }

  const filterSettings = query.filterSettings ? JSON.parse(query.filterSettings) : {};
  const exportSettings = { ...filterSettings, page: null, limit: null };

  let agreements = await getAgreements(user, exportSettings);
  // Filter out test agreements
  agreements = agreements.filter((agreement) => !agreement.forestFileId.startsWith(AGREEMENT_EXPORT.TEST_RAN_PREFIX));
  agreements.map((agreement) => agreement.transformToV1());

  const csvData = agreements.map((agreement) => {
    // Sort clients: primary (A) first, then others
    const sortedClients = agreement.clients.sort((a, b) => {
      if (a.clientTypeCode === 'A') return -1;
      if (b.clientTypeCode === 'A') return 1;
      return 0;
    });

    // Get licensee client name (client_type_id 1)
    const licenseeClient = agreement.clients.find((c) => c.clientTypeCode === '1');
    const clientName = licenseeClient?.name || '';

    // Get up to 5 agreement holders (from user account names) and emails, fill remaining with empty strings
    const holders = Array(5)
      .fill('')
      .map((_, index) => {
        const client = sortedClients[index];
        if (!client) return '';
        // Use user name if available, otherwise blank
        if (client.userGivenName || client.userFamilyName) {
          return `${client.userGivenName} ${client.userFamilyName}`.trim();
        }
        return '';
      });
    const emails = Array(5)
      .fill('')
      .map((_, index) => sortedClients[index]?.email || '');

    const row = {
      [AGREEMENT_EXPORT_COLUMNS.RAN]: agreement.forestFileId,
      [AGREEMENT_EXPORT_COLUMNS.LICENSE_TYPE]: Agreement.getLicenseTypeText(agreement),
      [AGREEMENT_EXPORT_COLUMNS.RANGE_NAME]: agreement.plan?.rangeName || '',
      [AGREEMENT_EXPORT_COLUMNS.LICENSEE]: clientName,
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_1]: holders[0],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_1_EMAIL]: emails[0],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_2]: holders[1],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_2_EMAIL]: emails[1],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_3]: holders[2],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_3_EMAIL]: emails[2],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_4]: holders[3],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_4_EMAIL]: emails[3],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_5]: holders[4],
      [AGREEMENT_EXPORT_COLUMNS.AGREEMENT_HOLDER_5_EMAIL]: emails[4],
      [AGREEMENT_EXPORT_COLUMNS.ZONE_AGROLOGIST]: agreement.zone?.user
        ? `${agreement.zone.user.givenName} ${agreement.zone.user.familyName}`
        : '',
      [AGREEMENT_EXPORT_COLUMNS.ZONE]: agreement.zone?.code || '',
      [AGREEMENT_EXPORT_COLUMNS.DISTRICT]: agreement.zone?.district?.code || '',
      [AGREEMENT_EXPORT_COLUMNS.PLAN_STATUS]: agreement.plan?.status?.name || AGREEMENT_EXPORT.NO_PLAN_DEFAULT,
      [AGREEMENT_EXPORT_COLUMNS.PLAN_START_DATE]: agreement.plan?.planStartDate
        ? moment(agreement.plan.planStartDate).format(AGREEMENT_EXPORT.DATE_FORMAT)
        : '',
      [AGREEMENT_EXPORT_COLUMNS.PLAN_END_DATE]: agreement.plan?.planEndDate
        ? moment(agreement.plan.planEndDate).format(AGREEMENT_EXPORT.DATE_FORMAT)
        : '',
      [AGREEMENT_EXPORT_COLUMNS.USAGE_STATUS]: Agreement.getUsageStatusText(agreement.usageStatus),
      [AGREEMENT_EXPORT_COLUMNS.PERCENTAGE_USE]: agreement.percentageUse || 0,
      [AGREEMENT_EXPORT_COLUMNS.HAS_CURRENT_SCHEDULE]: agreement.hasCurrentSchedule
        ? AGREEMENT_EXPORT.YES
        : AGREEMENT_EXPORT.NO,
      [AGREEMENT_EXPORT_COLUMNS.EXEMPTION_STATUS]: Agreement.getExemptionStatusText(agreement.exemptionStatus),
    };

    return row;
  });

  stringify(csvData, { header: true }, (err, output) => {
    if (err) {
      throw err;
    }
    res.setHeader('Content-Type', AGREEMENT_EXPORT.CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${AGREEMENT_EXPORT.FILENAME}"`);
    res.status(200).send(output);
  });
});

// Exemption routes nested under /agreement/:agreementId/exemption
const exemptionBase = '/:agreementId/exemption';
// Exemption history
router.get(`${exemptionBase}`, ExemptionController.index);
router.post(`${exemptionBase}`, ExemptionController.store);
router.put(`${exemptionBase}/:exemptionId`, ExemptionController.update);
router.delete(`${exemptionBase}/:exemptionId`, ExemptionController.destroy);
router.get(`${exemptionBase}/:exemptionId/download`, ExemptionController.downloadPDF);
// Exemption attachments
router.get(`${exemptionBase}/:exemptionId/attachments`, ExemptionController.getAttachments);
router.post(`${exemptionBase}/:exemptionId/attachments`, ExemptionController.uploadAttachment);
router.delete(`${exemptionBase}/:exemptionId/attachments/:attachmentId`, ExemptionController.deleteAttachment);
// Exemption status workflow/history routes
router.get(`${exemptionBase}/:exemptionId/status-history`, ExemptionStatusController.history);
router.post(`${exemptionBase}/:exemptionId/transition`, ExemptionStatusController.transition);

export default router;
