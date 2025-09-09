import * as Minio from 'minio';

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

export const cleanProductionURL = (publicUrl) => {
  publicUrl = publicUrl.replace('http', 'https');
  publicUrl = publicUrl.replace(':9000/', '/');
  return publicUrl;
};

/**
 * Delete a file from Minio storage
 * @param {string} filename - The filename to delete from Minio
 * @returns {Promise<boolean>} - true if deleted successfully, false if error
 */
export async function deleteFileFromMinio(filename) {
  try {
    // Decode the filename in case it's URL encoded
    const decodedFilename = decodeURIComponent(filename);
    await client.removeObject(bucket, decodedFilename);
    return true;
  } catch (error) {
    console.error(`Error deleting file from Minio (${filename}):`, error);
    return false;
  }
}

/**
 * Get file buffer from Minio storage
 * @param {string} filename - The filename to fetch
 * @returns {Promise<Buffer>} - Buffer of the file content
 */
export async function getFileBuffer(filename) {
  const decodedFilename = decodeURIComponent(filename);
  const stream = await client.getObject(bucket, decodedFilename);

  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

export { client, endPoint, publicEndPoint, bucket };
