import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '@/routers/index.js';
import { createContext } from '@/trpc/context.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env, isProduction } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: isProduction
      ? ['https://range.gov.bc.ca', 'https://*.gov.bc.ca']
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      logger.error(`tRPC error on ${path}: ${error.message}`, {
        code: error.code,
        stack: error.stack,
      });
    },
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Range API v2',
    version: '2.0.0',
    documentation: '/trpc',
  });
});

const server = app.listen(env.PORT, async () => {
  logger.info(`Server running on port ${env.PORT}`);
  await connectDatabase();
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDatabase();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
