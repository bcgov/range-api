import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { prisma } from '@/config/database.js';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  vi.clearAllMocks();
});
