import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import * as Minio from 'minio';
import { Router } from 'express';
import DataManager from '../../libs/db2';

const cleanProductionURL = (publicUrl) => {
  publicUrl = publicUrl.replace('http', 'https');
  publicUrl = publicUrl.replace(':9000/', '/');
  return publicUrl;
};

const dm = new DataManager();
const { db, PlanFile } = dm;

const endPoint = process.env.MINIO_ENDPOINT;
const publicEndPoint = process.env.MINIO_PUBLIC_ENDPOINT;
const port = process.env.MINIO_PORT;
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const bucket = process.env.MINIO_BUCKET;

if (!endPoint) {
  throw new Error('MINIO_ENDPOINT environment variable not provided');
}

if (!port) {
  throw new Error('MINIO_PORT environment variable not provided');
}

if (!accessKey) {
  throw new Error('MINIO_ACCESS_KEY environment variable not provided');
}

if (!secretKey) {
  throw new Error('MINIO_SECRET_KEY environment variable not provided');
}

if (!bucket) {
  throw new Error('MINIO_BUCKET environment variable not provided');
}

const client = new Minio.Client({
  endPoint,
  port: Number(port),
  useSSL: false,
  accessKey,
  secretKey,
  s3ForcePathStyle: true,
});

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

    if (!req.query.id) {
      throw errorWithCode('You must provide the file id via the `id` parameter', 400);
    }

    const planFile = await PlanFile.findById(db, Number(req.query.id));

    if (!planFile) {
      throw errorWithCode('File does not exist', 404);
    }

    const { access } = planFile;

    switch (access) {
      case 'staff_only':
        if (!user.isRangeOfficer() && !user.isAdministrator() && !user.isDecisionMaker()) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'user_only':
        if (user.id !== planFile.userId) {
          throw errorWithCode('Unauthorized', 403);
        }
        break;
      case 'everyone':
        break;
      default:
        throw errorWithCode('Unauthorized', 403);
    }

    const url = await client.presignedGetObject(bucket, decodeURIComponent(planFile.name));

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
      await client.removeObject(bucket, decodeURIComponent(planFile.name));

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
