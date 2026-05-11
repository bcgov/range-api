import { describe, it, expect, beforeAll } from 'vitest';

describe('config', () => {
  beforeAll(() => {
    process.env.POSTGRESQL_USER = 'test_user';
    process.env.POSTGRESQL_PASSWORD = 'test_pass';
    process.env.POSTGRESQL_DATABASE = 'test_db';
    process.env.POSTGRESQL_HOST = 'test_host';
    process.env.POSTGRESQL_PORT = '5432';
    process.env.SSO_URL = 'https://sso.example.com';
    process.env.PORT = '9000';
    process.env.HOST = '0.0.0.0';
  });

  it('loads environment from NODE_ENV', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.environment).toBe('unit_test');
  });

  it('reads port from env', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.port).toBe(9000);
  });

  it('reads host from env', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.host).toBe('0.0.0.0');
  });

  it('reads db config from env', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.db).toEqual({
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db',
      host: 'test_host',
      port: 5432,
    });
  });

  it('reads sso certsUrl from SSO_URL', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.sso.certsUrl).toBe('https://sso.example.com/certs');
  });

  it('loads temporaryUploadPath from JSON file', async () => {
    const config = (await import('../../src/config/index.js')).default;
    expect(config.temporaryUploadPath).toBe('uploads');
  });
});
