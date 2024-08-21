'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import UserDistricts from '../../libs/db2/model/userDistricts';
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
    agreement.isAgent = agentClientAgreements.some(
      (ca) => ca.agreementId === a.id,
    );
    return a;
  });
};

// Search agreements by RAN, contact name, and client name. This is only used by Web
router.get(
  '/search',
  asyncMiddleware(async (req, res) => {
    const { user, query } = req;
    const filterSettings = JSON.parse(query.filterSettings);
    const page = Number(filterSettings.page || 0);
    const limit = Number(filterSettings.limit || 10);
    let agreements = [];
    let totalItems = 0;
    if (user.isAgreementHolder()) {
      agreements = await getAgreeementsForAH(user, {
        ...filterSettings,
        limit: null,
        page: null,
      });
    } else if (
      user.isAdministrator() ||
      user.canReadAll() ||
      user.isRangeOfficer()
    ) {
      if (!(filterSettings?.selectedZones?.length === 0)) {
        agreements = await Agreement.findWithAllRelations(
          db,
          { 'ref_zone.id': filterSettings.selectedZones },
          {
            ...filterSettings,
            limit: null,
            page: null,
          },
          true,
        );
      }
    } else if (user.isDecisionMaker() || user.canReadDistrict()) {
      const districts = await UserDistricts.find(db, { user_id: user.id });
      const zones = await Zone.find(db, {
        district_id: districts.map((d) => d.id),
      });
      agreements = await Agreement.findWithAllRelations(
        db,
        { zone_id: zones.map((z) => z.id) },
        {
          ...filterSettings,
          limit: null,
          page: null,
        },
        false,
      );
    } else {
      throw errorWithCode('Unable to determine user role', 500);
    }
    totalItems = agreements.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    agreements = agreements.slice(startIndex, endIndex);
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
  }),
);

export default router;
