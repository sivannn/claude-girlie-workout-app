import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { provisionUserLibrary } from "@/lib/data/provisioning";

// "Stay logged in until explicit logout" on a phone: a 90-day server-set
// cookie, refreshed daily on activity (rolling), so anyone who opens the app
// at least once every 90 days never sees the login screen again. Server-set
// HTTP cookies survive iOS home-screen PWA storage; JS-set cookies do not.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 90;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

/**
 * The Better Auth configuration, parameterized by Prisma client so the app
 * (src/lib/auth-server.ts), admin scripts (scripts/*.ts), and tests can all
 * build an instance against their own database with identical behavior.
 */
export function buildAuthOptions(prisma: PrismaClient) {
  return {
    appName: "Steam",
    database: prismaAdapter(prisma, { provider: "sqlite" }),
    emailAndPassword: {
      enabled: true,
      // No email infrastructure at friend scale — verification stays off and
      // forgotten passwords go through scripts/reset-password.ts.
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      // Serve the session from a short-lived signed cookie instead of hitting
      // the database on every request — in production that lookup is a
      // network round-trip to Turso before any page can render. Tradeoff: a
      // revoked session stays usable for up to five minutes.
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    rateLimit: {
      // Default in-memory counters are per-serverless-instance (i.e. nearly
      // useless on Vercel); the database keeps one global counter, which is
      // what makes the built-in 3-per-10s signup/sign-in limits real.
      storage: "database",
    },
    advanced: {
      // Match the uuid ids used by every other model in prisma/schema.prisma.
      database: { generateId: "uuid" as const },
    },
    databaseHooks: {
      user: {
        create: {
          // WorkoutType/Exercise are per-user rows, so a fresh account has an
          // empty library until provisioned — without this, the engine has
          // nothing to recommend and onboarding's preview comes back null.
          after: async (user: { id: string }) => {
            await provisionUserLibrary(prisma, user.id);
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}
