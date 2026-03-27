import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SSO_URL: z.string().default('https://dev.loginproxy.gov.bc.ca/auth/realms/standard'),
  SSO_CLIENT_ID: z.string().default('my-range-3769'),
  SSO_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().default('http://localhost:5173'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment variables:', parseResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parseResult.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export const SSO_CONFIG = {
  url: env.SSO_URL,
  clientId: env.SSO_CLIENT_ID,
  clientSecret: env.SSO_CLIENT_SECRET,
  certsUrl: `${env.SSO_URL}/protocol/openid-connect/certs`,
  tokenUrl: `${env.SSO_URL}/protocol/openid-connect/token`,
  authUrl: `${env.SSO_URL}/protocol/openid-connect/auth`,
  logoutUrl: `${env.SSO_URL}/protocol/openid-connect/logout`,
};
