import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { provisionUserLibrary } from "@/lib/data/provisioning";
import { sendPasswordResetEmail } from "@/lib/email";

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
      // Verification stays off at friend scale, but forgotten passwords are
      // now self-serve: Better Auth's built-in reset flow emails a link via
      // Resend (src/lib/email.ts). Tokens live in the Verification table,
      // are single-use, and expire after the default hour.
      // scripts/reset-password.ts remains as an admin escape hatch for when
      // email delivery itself is the problem.
      requireEmailVerification: false,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
        await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl: url });
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    account: {
      accountLinking: {
        // Signing in with Google when a password account already has that
        // email must land in the existing account, not mint a duplicate.
        enabled: true,
        trustedProviders: ["google"],
        // Password accounts here never verify email (no verification flow
        // exists), and Better Auth's default refuses to link into an
        // unverified local account. Acceptable at friend scale: sign-ups are
        // effectively private, so the attack this guards against (squatting
        // an address you don't own to capture its Google login) isn't live.
        requireLocalEmailVerified: false,
      },
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
      // Tighter than the built-in 3-per-60s for reset requests: each one
      // sends a real email, and Resend's free tier is 100/day.
      customRules: {
        "/request-password-reset": { window: 60 * 15, max: 3 },
      },
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
