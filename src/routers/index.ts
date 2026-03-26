import { router } from '@/trpc/trpc.js';
import { agreementRouter } from './agreement.js';

export const appRouter = router({
  agreement: agreementRouter,
});

export type AppRouter = typeof appRouter;
