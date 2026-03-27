import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/trpc/trpc.js';
import { TRPCError } from '@trpc/server';

export const planRouter = router({
  list: publicProcedure
    .input(
      z.object({
        agreementId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().optional(),
        statusId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { agreementId, limit, cursor, statusId } = input;

      const plans = await ctx.prisma.plan.findMany({
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        where: {
          ...(agreementId && { agreementId }),
          ...(statusId && { statusId }),
        },
        include: {
          agreement: {
            include: {
              zone: {
                include: {
                  district: true,
                },
              },
            },
          },
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { plans };
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({
      where: { id: input.id },
      include: {
        agreement: {
          include: {
            zone: {
              include: {
                district: true,
              },
            },
            clientAgreements: {
              include: {
                client: true,
              },
            },
          },
        },
        status: true,
        creator: true,
        grazingSchedules: {
          include: {
            entries: {
              include: {
                pasture: true,
              },
            },
          },
        },
        pastures: {
          include: {
            plantCommunities: {
              include: {
                indicators: true,
              },
            },
          },
        },
        confirmations: true,
      },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Plan ${input.id} not found`,
      });
    }

    return plan;
  }),

  create: protectedProcedure
    .input(
      z.object({
        agreementId: z.string(),
        planStartDate: z.date().optional(),
        planEndDate: z.date().optional(),
        rangeName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const agreement = await ctx.prisma.agreement.findUnique({
        where: { forestFileId: input.agreementId },
      });

      if (!agreement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agreement not found',
        });
      }

      const status = await ctx.prisma.planStatus.findFirst({
        where: { code: 'C' },
      });

      return ctx.prisma.plan.create({
        data: {
          agreementId: input.agreementId,
          statusId: status?.id ?? 1,
          creatorId: ctx.userId!,
          planStartDate: input.planStartDate,
          planEndDate: input.planEndDate,
          rangeName: input.rangeName ?? '',
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        planStartDate: z.date().optional(),
        planEndDate: z.date().optional(),
        rangeName: z.string().optional(),
        altBusinessName: z.string().optional(),
        notes: z.string().optional(),
        conditions: z.string().optional(),
        proposedConditions: z.string().optional(),
        extensionStatus: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      return ctx.prisma.plan.update({
        where: { id },
        data,
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        statusId: z.number(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, statusId, note } = input;

      const plan = await ctx.prisma.plan.findUnique({ where: { id } });
      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      }

      await ctx.prisma.planStatusHistory.create({
        data: {
          planId: id,
          fromPlanStatusId: plan.statusId,
          toPlanStatusId: statusId,
          userId: ctx.userId!,
          note: note ?? '',
        },
      });

      return ctx.prisma.plan.update({
        where: { id },
        data: { statusId },
        include: { status: true },
      });
    }),

  submit: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const plan = await ctx.prisma.plan.findUnique({ where: { id: input.id } });
    if (!plan) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
    }

    const submittedStatus = await ctx.prisma.planStatus.findFirst({ where: { code: 'S' } });
    if (!submittedStatus) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Submitted status not found' });
    }

    await ctx.prisma.planStatusHistory.create({
      data: {
        planId: input.id,
        fromPlanStatusId: plan.statusId,
        toPlanStatusId: submittedStatus.id,
        userId: ctx.userId!,
        note: 'Plan submitted',
      },
    });

    return ctx.prisma.plan.update({
      where: { id: input.id },
      data: {
        statusId: submittedStatus.id,
        submittedAt: new Date(),
      },
      include: { status: true },
    });
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.plan.delete({ where: { id: input.id } });
    return { success: true };
  }),

  statusHistory: publicProcedure.input(z.object({ planId: z.number() })).query(async ({ ctx, input }) => {
    const history = await ctx.prisma.planStatusHistory.findMany({
      where: { planId: input.planId },
      orderBy: { createdAt: 'desc' },
    });
    return history;
  }),
});
