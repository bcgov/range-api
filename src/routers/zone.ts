import { z } from 'zod';
import { router, publicProcedure } from '@/trpc/trpc.js';

export const zoneRouter = router({
  list: publicProcedure
    .input(
      z.object({
        districtId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.zone.findMany({
        where: input.districtId ? { districtId: input.districtId } : undefined,
        include: {
          district: true,
        },
        orderBy: { code: 'asc' },
      });
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    return ctx.prisma.zone.findUnique({
      where: { id: input.id },
      include: {
        district: true,
      },
    });
  }),
});
