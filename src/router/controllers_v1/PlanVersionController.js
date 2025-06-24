import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import { generatePDFResponse } from './PDFGeneration';

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
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

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
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const versions = await PlanSnapshot.fetchAmendmentSubmissions(db, planId);
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

      const agreementId = await Plan.agreementIdForPlanId(db, versionData.planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      return res.json({ ...versionData.snapshot, version: versionData.version }).end();
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
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

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
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    if (!plan) {
      throw errorWithCode("Plan doesn't exist", 404);
    }
    const { agreementId } = plan;
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    try {
      const versionData = await PlanSnapshot.findOne(db, {
        plan_id: planId,
        version,
      });
      if (!versionData) throw errorWithCode('Could not find version for plan', 404);
      res.setHeader('Content-disposition', `attachment; filename=${agreementId}.pdf`);
      res.setHeader('Content-type', 'application/pdf');
      versionData.snapshot.amendmentSubmissions = await PlanSnapshot.fetchAmendmentSubmissions(
        db,
        planId,
        versionData.createdAt,
      );
      if (versionData.snapshot.amendmentSubmissions.length > 0)
        versionData.snapshot.originalApproval = {
          approver:
            versionData.snapshot.amendmentSubmissions[versionData.snapshot.amendmentSubmissions.length - 1].approvedBy,
          date: versionData.snapshot.amendmentSubmissions[versionData.snapshot.amendmentSubmissions.length - 1]
            .approvedAt,
        };
      versionData.snapshot.grazingSchedules = versionData.snapshot.grazingSchedules.map((schedule) => ({
        ...schedule,
        grazingScheduleEntries: schedule.grazingScheduleEntries.map((entry) => ({
          ...entry,
          dateIn: entry.dateIn ? new Date(entry.dateIn).toISOString().split('T')[0] : null,
          dateOut: entry.dateOut ? new Date(entry.dateOut).toISOString().split('T')[0] : null,
        })),
      }));
      const response = await generatePDFResponse(versionData.snapshot);
      PlanSnapshot.update(db, { plan_id: planId, version }, { pdf_file: response.data });
      res.send(response.data);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
