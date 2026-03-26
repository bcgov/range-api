import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger.js';
import { isTest } from '@/config/env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isTest ? [] : ['query', 'error', 'warn'],
  });

if (!isTest) {
  globalForPrisma.prisma = prisma;
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
  }
};
