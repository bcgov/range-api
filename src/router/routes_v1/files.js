import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import DataManager from '../../libs/db2';
import { ATTACHMENT_TYPE } from '../../constants';
import ExemptionAttachment from '../../libs/db2/model/exemptionattachment';
import { client, bucket, endPoint, publicEndPoint, cleanProductionURL, deleteFileFromMinio } from '../../libs/minio';

const dm = new DataManager();
const { db, PlanFile } = dm;

const router = new Router();

router.get(
  '/upload-url',
  asyncMiddleware(async (req, res) => {
    if (!req.query.name) {
      throw errorWithCode('You must provide a filename via the `name` parameter', 400);
    }

    const url = await client.presignedPutObject(bucket, req.query.name);

    const publicUrl = publicEndPoint ? url.replace(endPoint, publicEndPoint) : url;

    res.json({
      url: process.env.NODE_ENV === 'production' ? cleanProductionURL(publicUrl) : publicUrl,
    });
  }),
);

router.get(
  '/download-url',
  asyncMiddleware(async (req, res) => {
    const { user } = req;

    if (!req.query.fileType) {
      throw errorWithCode('You must provide the file type via the `fileType` parameter', 400);
    }
    if (!req.query.id) {
      throw errorWithCode('You must provide the file id via the `id` parameter', 400);
    }

    let file = null;
    const fileType = req.query.fileType;
    console.log('fileType', fileType);
    if (fileType && fileType === ATTACHMENT_TYPE.PLAN_ATTACHMENT) {
      file = await PlanFile.findById(db, Number(req.query.id));
    } else if (fileType && fileType === ATTACHMENT_TYPE.EXEMPTION_ATTACHMENT) {
      file = await ExemptionAttachment.findById(db, Number(req.query.id));
    } else {
      throw errorWithCode('You must provide a valid fileType via the `fileType` parameter', 400);
    }

    if (!file) {
      throw errorWithCode('File does not exist', 404);
    }

    const { access } = file;

    switch (access) {
      case 'staff_only':
        if (!user.isRangeOfficer() && !user.isAdministrator() && !user.isDecisionMaker()) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'user_only':
        if (user.id !== file.userId) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'everyone':
        break;
      default:
        throw errorWithCode('Unauthorized', 403);
    }

    const url = await client.presignedGetObject(bucket, decodeURIComponent(file.name));

    const publicUrl = publicEndPoint ? url.replace(endPoint, publicEndPoint) : url;

    res.json({
      url: process.env.NODE_ENV === 'production' ? cleanProductionURL(publicUrl) : publicUrl,
    });
  }),
);

router.delete(
  '/delete',
  asyncMiddleware(async (req, res) => {
    const { user } = req;

    if (!req.query.id) {
      throw errorWithCode('You must provide the file id via the `id` parameter', 400);
    }

    const planFile = await PlanFile.findById(db, Number(req.query.id));

    if (!planFile) {
      throw errorWithCode('File does not exist', 404);
    }

    const { access } = planFile;

    // Check authorization - only staff or the file owner can delete files
    switch (access) {
      case 'staff_only':
        if (!user.isRangeOfficer() && !user.isAdministrator() && !user.isDecisionMaker()) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'user_only':
        if (
          user.id !== planFile.userId &&
          !user.isRangeOfficer() &&
          !user.isAdministrator() &&
          !user.isDecisionMaker()
        ) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'everyone':
        // For 'everyone' access, only staff or the file owner can delete
        if (
          user.id !== planFile.userId &&
          !user.isRangeOfficer() &&
          !user.isAdministrator() &&
          !user.isDecisionMaker()
        ) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      default:
        throw errorWithCode('Unauthorized', 403);
    }

    try {
      // Delete the file from MinIO storage
      await deleteFileFromMinio(planFile.name);

      // Delete the file record from the database
      await PlanFile.remove(db, { id: planFile.id });

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      throw errorWithCode(`Failed to delete file: ${error.message}`, 500);
    }
  }),
);

export default router;
