import { z } from 'zod';
import { router, publicProcedure } from '@/trpc/trpc.js';
import { TRPCError } from '@trpc/server';

export const clientRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      const clients = await ctx.prisma.client.findMany({
        take: limit + 1,
        ...(cursor && { cursor: { clientNumber: cursor }, skip: 1 }),
        where: {
          ...(search && {
            OR: [
              { clientNumber: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { clientNumber: 'asc' },
      });

      let nextCursor: string | undefined;
      if (clients.length > limit) {
        const nextItem = clients.pop();
        nextCursor = nextItem?.clientNumber;
      }

      return { clients, nextCursor };
    }),

  byId: publicProcedure.input(z.object({ clientNumber: z.string() })).query(async ({ ctx, input }) => {
    const client = await ctx.prisma.client.findUnique({
      where: { clientNumber: input.clientNumber },
      include: {
        userClientLinks: {
          include: {
            user: true,
          },
        },
        clientAgreements: {
          include: {
            agreement: true,
            clientType: true,
          },
        },
      },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Client ${input.clientNumber} not found`,
      });
    }

    return client;
  }),
});
