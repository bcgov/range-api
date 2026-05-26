import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env.NODE_ENV || 'development';

if (env === 'development') {
  dotenv.config();
}

if (!process.env.SSO_URL) {
  throw new Error('SSO_URL is not set');
}

interface DBConfig {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
}

interface SSOConfig {
  clientId: string;
  callback: string;
  authUrl: string;
  tokenUrl: string;
  certsUrl: string;
}

interface Config {
  environment: string;
  host: string;
  port: number;
  db: DBConfig;
  sso: SSOConfig;
  appUrl: string;
  temporaryUploadPath: string;
  archiveFileBaseName: string;
}

function loadJsonConfig(envName: string): Record<string, unknown> {
  try {
    const filePath = path.join(__dirname, `${envName}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

const jsonConfig = loadJsonConfig(env);

const config: Config = {
  environment: env,
  host: process.env.HOST || '127.0.0.1',
  port: parseInt(process.env.PORT || '8000', 10),
  db: {
    user: process.env.POSTGRESQL_USER || '',
    password: process.env.POSTGRESQL_PASSWORD || '',
    database:
      env === 'test' && process.env.POSTGRESQL_DATABASE_TEST
        ? process.env.POSTGRESQL_DATABASE_TEST
        : process.env.POSTGRESQL_DATABASE || '',
    host: process.env.POSTGRESQL_HOST || '',
    port: parseInt(process.env.POSTGRESQL_PORT || '5432', 10),
  },
  sso: {
    clientId: 'myrangebc',
    callback: '/v1/auth/callback',
    authUrl: `${process.env.SSO_URL}/auth`,
    tokenUrl: `${process.env.SSO_URL}/token`,
    certsUrl: `${process.env.SSO_URL}/certs`,
  },
  appUrl: process.env.APP_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '8000'}`,
  temporaryUploadPath: (jsonConfig.temporaryUploadPath as string) || 'uploads',
  archiveFileBaseName: (jsonConfig.archiveFileBaseName as string) || 'IMG_',
};

export default config;
