import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '@/config/database.js';
import { logger } from '@/utils/logger.js';

export interface Context {
  prisma: typeof prisma;
  userId?: number;
  logger: typeof logger;
}

export const createContext = (_opts: CreateExpressContextOptions): Context => {
  return {
    prisma,
    logger,
  };
};

export type ContextType = inferAsyncReturnType<typeof createContext>;
