import { router, publicProcedure, protectedProcedure } from '@/trpc/trpc.js';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { SSO_CONFIG, env } from '@/config/env.js';

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    return ctx.user;
  }),

  getLoginUrl: publicProcedure.query(async () => {
    const redirectUri = `${env.APP_URL}/return-page`;
    const loginUrl = `${SSO_CONFIG.authUrl}?client_id=${SSO_CONFIG.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return { loginUrl };
  }),

  getLoginUrlWithIdp: publicProcedure
    .input(z.object({ idp: z.enum(['idir', 'bceid']).optional() }))
    .query(async ({ input }) => {
      const redirectUri = `${env.APP_URL}/return-page`;
      let loginUrl = `${SSO_CONFIG.authUrl}?client_id=${SSO_CONFIG.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
      if (input.idp) {
        loginUrl += `&kc_idp_hint=${input.idp}`;
      }
      return { loginUrl };
    }),

  logout: protectedProcedure.mutation(async () => {
    const redirectUri = encodeURIComponent(`${env.APP_URL}/return-page?type=LOGOUT`);
    const logoutUrl = `${SSO_CONFIG.logoutUrl}?post_logout_redirect_uri=${redirectUri}&client_id=${SSO_CONFIG.clientId}`;
    return { logoutUrl };
  }),

  refreshToken: protectedProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const response = await fetch(SSO_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: input.refreshToken,
          client_id: SSO_CONFIG.clientId,
          ...(SSO_CONFIG.clientSecret && { client_secret: SSO_CONFIG.clientSecret }),
        }),
      });

      if (!response.ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Failed to refresh token' });
      }

      return response.json();
    }),
});
