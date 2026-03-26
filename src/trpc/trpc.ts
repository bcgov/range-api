import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { ContextType } from './context.js';
import { ZodError } from 'zod';

const t = initTRPC.context<ContextType>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

export const adminProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    // TODO: Add admin role check
    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    });
  }),
);
