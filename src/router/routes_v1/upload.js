import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import * as Minio from 'minio';
import { Router } from 'express';

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
  useSSL: process.env.NODE_ENV === 'production',
  accessKey,
  secretKey,
  s3ForcePathStyle: true,
});

const router = new Router();

router.get('/signed-url', asyncMiddleware(async (req, res) => {
  if (!req.query.name) {
    throw errorWithCode('You must provide a filename via the `name` parameter', 400);
  }

  const url = await client.presignedPutObject(bucket, req.query.name);

  res.json({
    url: publicEndPoint
      ? url.replace(endPoint, publicEndPoint)
      : url,
  });
}));

export default router;
