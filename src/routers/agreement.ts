import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/trpc/trpc.js';
import { TRPCError } from '@trpc/server';

export const agreementRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        search: z.string().optional(),
        districtId: z.number().optional(),
        zoneId: z.number().optional(),
        includeRetired: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search, districtId, zoneId, includeRetired } = input;

      const agreements = await ctx.prisma.agreement.findMany({
        take: limit + 1,
        ...(cursor && { cursor: { forestFileId: cursor }, skip: 1 }),
        where: {
          ...(!includeRetired && { retired: false }),
          ...(search && {
            forestFileId: { contains: search, mode: 'insensitive' },
          }),
          ...(districtId && {
            zone: { districtId },
          }),
          ...(zoneId && { zoneId }),
        },
        include: {
          agreementType: true,
          zone: {
            include: {
              district: true,
            },
          },
          clientAgreements: {
            include: {
              client: true,
              clientType: true,
            },
          },
        },
        orderBy: { forestFileId: 'desc' },
      });

      let nextCursor: string | undefined;
      if (agreements.length > limit) {
        const nextItem = agreements.pop();
        nextCursor = nextItem?.forestFileId;
      }

      return {
        agreements,
        nextCursor,
      };
    }),

  byId: publicProcedure.input(z.object({ forestFileId: z.string() })).query(async ({ ctx, input }) => {
    const agreement = await ctx.prisma.agreement.findUnique({
      where: { forestFileId: input.forestFileId },
      include: {
        agreementType: true,
        zone: {
          include: {
            district: true,
          },
        },
        clientAgreements: {
          include: {
            client: true,
            clientType: true,
          },
        },
        plans: {
          include: {
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agreement) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Agreement ${input.forestFileId} not found`,
      });
    }

    return agreement;
  }),

  search: publicProcedure.input(z.object({ term: z.string().min(1) })).query(async ({ ctx, input }) => {
    const agreements = await ctx.prisma.agreement.findMany({
      where: {
        OR: [
          { forestFileId: { contains: input.term, mode: 'insensitive' } },
          { zone: { description: { contains: input.term, mode: 'insensitive' } } },
        ],
      },
      include: {
        zone: {
          include: {
            district: true,
          },
        },
      },
      take: 20,
    });

    return agreements;
  }),

  create: protectedProcedure
    .input(
      z.object({
        forestFileId: z.string().min(1).max(20),
        agreementStartDate: z.date(),
        agreementEndDate: z.date(),
        agreementTypeId: z.number(),
        zoneId: z.number(),
        exemptionStatus: z.string().default('NOT_EXEMPTED'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.agreement.findUnique({
        where: { forestFileId: input.forestFileId },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Agreement ${input.forestFileId} already exists`,
        });
      }

      return ctx.prisma.agreement.create({
        data: input,
      });
    }),
});
