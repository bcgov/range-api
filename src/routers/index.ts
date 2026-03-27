import { router } from '@/trpc/trpc.js';
import { authRouter } from './auth.js';
import { agreementRouter } from './agreement.js';
import { planRouter } from './plan.js';
import { userRouter } from './user.js';
import { districtRouter } from './district.js';
import { zoneRouter } from './zone.js';
import { clientRouter } from './client.js';
import { referenceRouter } from './reference.js';

export const appRouter = router({
  auth: authRouter,
  agreement: agreementRouter,
  plan: planRouter,
  user: userRouter,
  district: districtRouter,
  zone: zoneRouter,
  client: clientRouter,
  reference: referenceRouter,
});

export type AppRouter = typeof appRouter;
