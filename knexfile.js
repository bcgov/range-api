// Update with your config settings.

const dotenv = require('dotenv');

const env = process.env.NODE_ENV || 'development';

if (env === 'development') {
  dotenv.config();
}

module.exports = {
  testing: {
    client: 'postgresql',
    connection: {
      host: process.env.POSTGRESQL_HOST,
      database: process.env.POSTGRESQL_DATABASE,
      user: process.env.POSTGRESQL_TEST_USER,
      password: process.env.POSTGRESQL_TEST_PASSWORD,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      // stub: './config/knex-migration-stub.js',
      tableName: 'migration',
      directory: 'server/libs/db2/migrations',
    },
  },
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.POSTGRESQL_HOST,
      database: process.env.POSTGRESQL_DATABASE,
      user: process.env.POSTGRESQL_DEV_USER,
      password: process.env.POSTGRESQL_DEV_PASSWORD,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      // stub: './config/knex-migration-stub.js',
      tableName: 'migration',
      directory: 'server/libs/db2/migrations',
    },
    seeds: {
      // stub: './config/knex-migration-stub.js',
      tableName: 'seed',
      directory: 'server/libs/db2/seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.POSTGRESQL_HOST,
      database: process.env.POSTGRESQL_DATABASE,
      user: process.env.POSTGRESQL_USER,
      password: process.env.POSTGRESQL_PASSWORD,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'migration',
      directory: 'server/libs/db2/migrations',
    },
  },
};
