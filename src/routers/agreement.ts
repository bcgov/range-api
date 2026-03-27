import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/trpc/trpc.js';
import { TRPCError } from '@trpc/server';

export const agreementRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        skip: z.number().min(0).default(0),
        search: z.string().optional(),
        districtId: z.number().optional(),
        zoneId: z.number().optional(),
        includeRetired: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, skip, search, districtId, zoneId, includeRetired } = input;

      const where = {
        ...(!includeRetired && { retired: false }),
        ...(search && {
          forestFileId: { contains: search },
        }),
        ...(districtId && {
          zone: { districtId },
        }),
        ...(zoneId && { zoneId }),
      };

      const [agreements, total] = await Promise.all([
        ctx.prisma.agreement.findMany({
          take: limit,
          skip,
          where,
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
          orderBy: { forestFileId: 'desc' },
        }),
        ctx.prisma.agreement.count({ where }),
      ]);

      return {
        agreements,
        total,
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
            creator: true,
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

  update: protectedProcedure
    .input(
      z.object({
        forestFileId: z.string(),
        agreementStartDate: z.date().optional(),
        agreementEndDate: z.date().optional(),
        exemptionStatus: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { forestFileId, ...data } = input;
      return ctx.prisma.agreement.update({
        where: { forestFileId },
        data,
      });
    }),

  retire: protectedProcedure.input(z.object({ forestFileId: z.string() })).mutation(async ({ ctx, input }) => {
    const agreement = await ctx.prisma.agreement.findUnique({
      where: { forestFileId: input.forestFileId },
    });

    if (!agreement) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Agreement not found',
      });
    }

    return ctx.prisma.agreement.update({
      where: { forestFileId: input.forestFileId },
      data: { retired: true },
    });
  }),

  unretire: protectedProcedure.input(z.object({ forestFileId: z.string() })).mutation(async ({ ctx, input }) => {
    const agreement = await ctx.prisma.agreement.findUnique({
      where: { forestFileId: input.forestFileId },
    });

    if (!agreement) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Agreement not found',
      });
    }

    return ctx.prisma.agreement.update({
      where: { forestFileId: input.forestFileId },
      data: { retired: false },
    });
  }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const [totalAgreements, activeAgreements, retiredAgreements, totalPlans, activePlans] = await Promise.all([
      ctx.prisma.agreement.count(),
      ctx.prisma.agreement.count({ where: { retired: false } }),
      ctx.prisma.agreement.count({ where: { retired: true } }),
      ctx.prisma.plan.count(),
      ctx.prisma.plan.count({
        where: {
          status: { code: { not: 'RE' } },
        },
      }),
    ]);

    return {
      totalAgreements,
      activeAgreements,
      retiredAgreements,
      totalPlans,
      activePlans,
    };
  }),
});
