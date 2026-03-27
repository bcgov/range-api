import { router, publicProcedure } from '@/trpc/trpc.js';

export const referenceRouter = router({
  agreementTypes: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.agreementType.findMany({
      orderBy: { description: 'asc' },
    });
  }),

  planStatuses: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.planStatus.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }),

  clientTypes: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.clientType.findMany({
      where: { active: true },
      orderBy: { description: 'asc' },
    });
  }),

  roles: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.roles.findMany();
  }),
});
