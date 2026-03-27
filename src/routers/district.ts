import { z } from 'zod';
import { router, publicProcedure } from '@/trpc/trpc.js';

export const districtRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, search } = input;

      const districts = await ctx.prisma.district.findMany({
        take: limit,
        where: {
          ...(search && {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { description: 'asc' },
      });

      return districts;
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const district = await ctx.prisma.district.findUnique({
      where: { id: input.id },
      include: {
        zones: true,
      },
    });

    return district;
  }),
});
