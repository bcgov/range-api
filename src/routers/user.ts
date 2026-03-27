import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/trpc/trpc.js';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, search } = input;

      const users = await ctx.prisma.user.findMany({
        take: limit,
        where: {
          active: true,
          ...(search && {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { givenName: { contains: search, mode: 'insensitive' } },
              { familyName: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { givenName: 'asc' },
      });

      return users;
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: input.id },
      include: { roles: true },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return user;
  }),

  current: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: { roles: true },
    });

    return user;
  }),
});
