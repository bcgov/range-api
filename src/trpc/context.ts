import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '@/config/database.js';
import { logger } from '@/utils/logger.js';
import { SSO_CONFIG, isDevelopment } from '@/config/env.js';

export interface User {
  id: number;
  username: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  active: boolean;
  roles: { id: number; name: string }[];
}

export interface SSOUser {
  sub: string;
  preferred_username: string;
  email: string;
  given_name?: string;
  family_name?: string;
  identity_provider: string;
  idir_username?: string;
  bceid_username?: string;
  client_roles?: string[];
}

export interface Context {
  prisma: typeof prisma;
  userId?: number;
  user?: User;
  ssoUser?: SSOUser;
  logger: typeof logger;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJWKS = () => {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(SSO_CONFIG.certsUrl));
  }
  return jwks;
};

export const createContext = async (opts: CreateExpressContextOptions): Promise<Context> => {
  const context: Context = {
    prisma,
    logger,
  };

  const authHeader = opts.req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, getJWKS(), {
        issuer: SSO_CONFIG.url,
        audience: SSO_CONFIG.clientId,
      });

      const ssoUser = payload as unknown as SSOUser;

      if (ssoUser.preferred_username) {
        context.ssoUser = ssoUser;

        let user = await prisma.user.findUnique({
          where: { username: ssoUser.preferred_username },
          include: { roles: true },
        });

        if (!user && ssoUser.identity_provider) {
          let computedUsername: string | null = null;
          if (ssoUser.identity_provider.toLowerCase().includes('idir')) {
            computedUsername = `idir\\${ssoUser.idir_username?.toLowerCase()}`;
          } else if (ssoUser.identity_provider.toLowerCase().includes('bceid')) {
            computedUsername = `bceid\\${ssoUser.bceid_username?.toLowerCase()}`;
          }

          if (computedUsername) {
            user = await prisma.user.findUnique({
              where: { username: computedUsername },
              include: { roles: true },
            });
          }
        }

        if (!user) {
          user = await prisma.user.create({
            data: {
              username: ssoUser.preferred_username,
              email: ssoUser.email,
              givenName: ssoUser.given_name || null,
              familyName: ssoUser.family_name || null,
              active: true,
            },
            include: { roles: true },
          });
        }

        let ssoId: string | null = null;
        if (ssoUser.identity_provider?.toLowerCase().includes('idir')) {
          ssoId = `idir\\${ssoUser.idir_username?.toLowerCase()}`;
        } else if (ssoUser.identity_provider?.toLowerCase().includes('bceid')) {
          ssoId = `bceid\\${ssoUser.bceid_username?.toLowerCase()}`;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            ssoId,
            email: ssoUser.email,
            lastLoginAt: new Date(),
          },
        });

        context.userId = user.id;
        context.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          givenName: user.givenName,
          familyName: user.familyName,
          active: user.active,
          roles: user.roles ? [{ id: user.roles.id, name: user.roles.description }] : [],
        };
      }
    } catch (error) {
      if (isDevelopment) {
        logger.debug(`SSO JWT verification failed: ${error}`);
      }
    }
  }

  return context;
};

export type ContextType = inferAsyncReturnType<typeof createContext>;
