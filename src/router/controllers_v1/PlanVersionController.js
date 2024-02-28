import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import { generatePDFResponse } from './PDFGeneration';
import PlanStatusHistory from '../../libs/db2/model/planstatushistory';

const fs = require('fs');

const dm = new DataManager(config);
const { db, Plan, Agreement } = dm;

export default class PlanVersionController {
  static async store(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const snapshot = await Plan.createSnapshot(db, planId, user);

      return res.status(200).json(snapshot).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async showAll(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const versions = await PlanSnapshot.findSummary(
        db,
        { plan_id: planId },
        'effective_legal_start',
      );

      await Promise.all(
        versions.map(async (v) => {
          v.fetchStatus(db);
          if (!v.snapshot.originalApproval)
            v.snapshot.originalApproval =
              await PlanStatusHistory.fetchOriginalApproval(db, planId);
          return v;
        }),
      );

      return res.status(200).json({ versions }).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async show(req, res) {
    const { user, params } = req;
    const { planId, version } = params;

    checkRequiredFields(['planId', 'version'], 'params', req);

    try {
      const versionData = await PlanSnapshot.findOne(db, {
        plan_id: planId,
        version,
      });

      if (!versionData) {
        throw errorWithCode('Could not find version for plan', 404);
      }

      const agreementId = await Plan.agreementIdForPlanId(
        db,
        versionData.planId,
      );
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      return res
        .json({ ...versionData.snapshot, version: versionData.version })
        .end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async restoreVersion(req, res) {
    const { user, params } = req;
    const { planId, version } = params;

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      await Plan.restoreVersion(db, planId, version);

      res.status(200).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async download(req, res) {
    const { user, params } = req;
    const { planId, version } = params;
    checkRequiredFields(['planId', 'version'], 'params', req);
    const [plan] = await Plan.findWithStatusExtension(
      db,
      { 'plan.id': planId },
      ['id', 'desc'],
    );
    if (!plan) {
      throw errorWithCode("Plan doesn't exist", 404);
    }
    const { agreementId } = plan;
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );
    try {
      const versionData = await PlanSnapshot.findOne(db, {
        plan_id: planId,
        version,
      });
      if (!versionData)
        throw errorWithCode('Could not find version for plan', 404);
      res.setHeader(
        'Content-disposition',
        `attachment; filename=${agreementId}.pdf`,
      );
      res.setHeader('Content-type', 'application/pdf');
      if (!versionData.pdfFile) {
        versionData.snapshot.originalApproval =
          await PlanStatusHistory.fetchOriginalApproval(db, planId);
        const amendmentSubmissions =
          await PlanStatusHistory.fetchAmendmentSubmissions(
            db,
            planId,
            versionData.createdAt,
          );
        versionData.snapshot.amendmentSubmissions = amendmentSubmissions;
        const response = await generatePDFResponse(versionData.snapshot);
        PlanSnapshot.update(
          db,
          { plan_id: planId, version },
          { pdf_file: response.data },
        );
        res.send(response.data);
      } else {
        res.send(versionData.pdfFile);
      }
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
