import type { inferAsyncReturnType } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { prisma } from '@/config/database.js';
import { logger } from '@/utils/logger.js';

export interface Context {
  prisma: typeof prisma;
  userId?: number;
  logger: typeof logger;
}

export const createContext = async ({ req, res }: FetchCreateContextFnOptions): Promise<Context> => {
  return {
    prisma,
    logger,
  };
};

export type ContextType = inferAsyncReturnType<typeof createContext>;
