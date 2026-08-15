import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { betterAuth } from "better-auth";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { EXERCISE_LIBRARY } from "@/lib/data/exercises";
import { WORKOUT_TYPE_LIBRARY } from "@/lib/data/workout-types";
import { provisionUserLibrary } from "@/lib/data/provisioning";
import { buildAuthOptions } from "@/lib/auth-options";

// Auth + provisioning + legacy-migration tests run against throwaway copies
// of the dev database so the real dev.db is never touched. The dev.db file is
// expected to exist with migrations applied (`npm run db:migrate`).

const DEV_DB = path.join(process.cwd(), "prisma", "dev.db");
const LEGACY_EMAIL = "sivsivlevy@gmail.com";

let tmpDir: string;

function copyDevDb(name: string): string {
  const target = path.join(tmpDir, name);
  fs.copyFileSync(DEV_DB, target);
  return target;
}

function clientFor(dbPath: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbPath }) });
}

/** A migrated-but-empty database: copy dev.db, then wipe all rows. */
async function emptyDb(name: string): Promise<{ path: string; prisma: PrismaClient }> {
  const dbPath = copyDevDb(name);
  const prisma = clientFor(dbPath);
  await prisma.user.deleteMany(); // cascades to every per-user table
  await prisma.verification.deleteMany();
  return { path: dbPath, prisma };
}

/**
 * An empty database with a pre-auth "legacy" account in the exact shape the
 * old single-user app leaves behind: no credential, provisioned library,
 * completed onboarding, a body-weight log, and a planned calendar event.
 * Built from scratch so the tests don't depend on dev.db's seed state.
 */
async function legacyFixtureDb(name: string) {
  const { path: dbPath, prisma } = await emptyDb(name);
  const legacy = await prisma.user.create({ data: { email: LEGACY_EMAIL, name: "Siv" } });
  await provisionUserLibrary(prisma, legacy.id);
  await prisma.userPreferences.update({
    where: { userId: legacy.id },
    data: { onboardingCompletedAt: new Date("2026-08-01T12:00:00Z"), bodyWeightLb: 140 },
  });
  await prisma.bodyWeightLog.create({
    data: { userId: legacy.id, date: new Date("2026-08-01T12:00:00Z"), weightLb: 140 },
  });
  const anyType = await prisma.workoutType.findFirstOrThrow({ where: { userId: legacy.id } });
  await prisma.workoutEvent.create({
    data: {
      userId: legacy.id,
      workoutTypeId: anyType.id,
      scheduledDate: new Date(),
      status: "PLANNED",
      createdBy: "AI",
    },
  });
  return { path: dbPath, prisma, legacyId: legacy.id };
}

function authFor(prisma: PrismaClient) {
  return betterAuth(buildAuthOptions(prisma));
}

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "test-secret-for-vitest-only";
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-auth-test-"));
  if (!fs.existsSync(DEV_DB)) {
    throw new Error("prisma/dev.db not found — run `npm run db:migrate` first.");
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("signup provisioning", () => {
  it("creates the account, credential, session, and full library on signup", async () => {
    const { prisma } = await emptyDb("signup.db");
    const auth = authFor(prisma);

    const result = await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "letmelift123" },
    });
    expect(result.user.email).toBe("friend@example.com");
    expect(result.token).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "friend@example.com" } });
    const [credentials, types, exercises, prefs, preferences] = await Promise.all([
      prisma.account.count({ where: { userId: user.id, providerId: "credential" } }),
      prisma.workoutType.count({ where: { userId: user.id } }),
      prisma.exercise.count({ where: { userId: user.id } }),
      prisma.exercisePreference.count({ where: { userId: user.id } }),
      prisma.userPreferences.findUnique({ where: { userId: user.id } }),
    ]);
    expect(credentials).toBe(1);
    expect(types).toBe(WORKOUT_TYPE_LIBRARY.length);
    expect(exercises).toBe(EXERCISE_LIBRARY.length);
    expect(prefs).toBe(EXERCISE_LIBRARY.length);
    // Preferences row must exist (onboarding's completeOnboarding does an
    // `update`) but onboarding must still be pending.
    expect(preferences).not.toBeNull();
    expect(preferences?.onboardingCompletedAt).toBeNull();
    // Signups start neutral — no HIGH-priority bias like the dev seed.
    const high = await prisma.exercisePreference.count({
      where: { userId: user.id, priority: "HIGH" },
    });
    expect(high).toBe(0);
  });

  it("is idempotent when run again over an already-provisioned user", async () => {
    const { prisma } = await emptyDb("idempotent.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "letmelift123" },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "friend@example.com" } });

    await provisionUserLibrary(prisma, user.id);
    await provisionUserLibrary(prisma, user.id);

    expect(await prisma.workoutType.count({ where: { userId: user.id } })).toBe(WORKOUT_TYPE_LIBRARY.length);
    expect(await prisma.exercise.count({ where: { userId: user.id } })).toBe(EXERCISE_LIBRARY.length);
    expect(await prisma.exercisePreference.count({ where: { userId: user.id } })).toBe(EXERCISE_LIBRARY.length);
  });

  it("signs in with the right password and rejects the wrong one", async () => {
    const { prisma } = await emptyDb("signin.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "letmelift123" },
    });

    const ok = await auth.api.signInEmail({
      body: { email: "friend@example.com", password: "letmelift123" },
    });
    expect(ok.token).toBeTruthy();

    await expect(
      auth.api.signInEmail({ body: { email: "friend@example.com", password: "wrong-password" } })
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });

  it("rejects passwords under 8 characters", async () => {
    const { prisma } = await emptyDb("shortpw.db");
    const auth = authFor(prisma);
    await expect(
      auth.api.signUpEmail({ body: { name: "T", email: "t@example.com", password: "short" } })
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });

  it("sessions are created with the 90-day expiry", async () => {
    const { prisma } = await emptyDb("expiry.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "letmelift123" },
    });
    const session = await prisma.session.findFirstOrThrow();
    const days = (session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90.1);
  });
});

describe("password reset", () => {
  /**
   * Intercepts the Resend API call so tests capture the outgoing email
   * instead of sending one. Everything else falls through to real fetch.
   */
  function stubResend() {
    const sent: Array<{ to: string; subject: string; text: string; html?: string; from: string }> = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.resend.com/")) {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: "test-email-id" }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch);
    return sent;
  }

  beforeAll(() => {
    process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
    process.env.RESEND_API_KEY ??= "re_dummy_key_for_vitest";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emails a single-use reset link whose token actually changes the password", async () => {
    const { prisma } = await emptyDb("reset.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "oldpassword1" },
    });
    const sent = stubResend();

    const res = await auth.api.requestPasswordReset({
      body: { email: "friend@example.com", redirectTo: "/reset-password" },
    });
    expect(res.status).toBe(true);

    // The email is plain text (no HTML, so no tracking pixels), from Steam,
    // and carries the reset link.
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toContain("Steam");
    expect(sent[0].to).toBe("friend@example.com");
    expect(sent[0].html).toBeUndefined();
    const url = sent[0].text.match(/https?:\/\/\S+/)?.[0];
    expect(url).toContain("/reset-password/");
    const token = url!.split("/reset-password/")[1].split("?")[0];

    // The token is backed by a Verification row that expires in ~an hour.
    const verification = await prisma.verification.findFirstOrThrow({
      where: { identifier: `reset-password:${token}` },
    });
    const minutes = (verification.expiresAt.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(61);

    await auth.api.resetPassword({ body: { newPassword: "newpassword2", token } });

    // New password works, old one doesn't.
    const ok = await auth.api.signInEmail({
      body: { email: "friend@example.com", password: "newpassword2" },
    });
    expect(ok.token).toBeTruthy();
    await expect(
      auth.api.signInEmail({ body: { email: "friend@example.com", password: "oldpassword1" } })
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });

    // Single-use: the same token is dead on arrival the second time.
    await expect(
      auth.api.resetPassword({ body: { newPassword: "thirdpassword3", token } })
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });

  it("answers identically for unknown emails and sends nothing", async () => {
    const { prisma } = await emptyDb("reset-unknown.db");
    const auth = authFor(prisma);
    const sent = stubResend();

    const res = await auth.api.requestPasswordReset({
      body: { email: "nobody@example.com", redirectTo: "/reset-password" },
    });
    // Same success-shaped response as the registered case — the endpoint
    // never reveals whether an address has an account.
    expect(res.status).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    const { prisma } = await emptyDb("reset-expired.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Test Friend", email: "friend@example.com", password: "oldpassword1" },
    });
    const sent = stubResend();
    await auth.api.requestPasswordReset({
      body: { email: "friend@example.com", redirectTo: "/reset-password" },
    });
    const token = sent[0].text.match(/https?:\/\/\S+/)?.[0]!.split("/reset-password/")[1].split("?")[0];

    // Age the token past its expiry rather than waiting an hour.
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      auth.api.resetPassword({ body: { newPassword: "newpassword2", token: token! } })
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });
});

describe("google sign-in configuration", () => {
  // The OAuth dance itself needs a browser and a real Google session — it's
  // covered by the manual end-to-end pass. These pin the config choices that
  // make it behave correctly, so a refactor can't silently drop them.
  it("links Google into an existing same-email account instead of duplicating", () => {
    const options = buildAuthOptions({} as PrismaClient);
    expect(options.account.accountLinking.enabled).toBe(true);
    expect(options.account.accountLinking.trustedProviders).toContain("google");
    // Password accounts never verify email here, so the default
    // requireLocalEmailVerified=true would refuse to link and mint a
    // duplicate account instead.
    expect(options.account.accountLinking.requireLocalEmailVerified).toBe(false);
  });

  it("rate-limits reset requests through the shared database-backed limiter", () => {
    const options = buildAuthOptions({} as PrismaClient);
    expect(options.rateLimit.storage).toBe("database");
    expect(options.rateLimit.customRules["/request-password-reset"]).toEqual({
      window: 60 * 15,
      max: 3,
    });
  });
});

describe("legacy-user migration script", () => {
  const script = path.join(process.cwd(), "scripts", "migrate-legacy-user.ts");

  function runScript(args: string[], expectFailure = false): string {
    try {
      return execFileSync("npx", ["tsx", script, ...args], {
        encoding: "utf8",
        env: { ...process.env, TURSO_DATABASE_URL: "" },
      });
    } catch (e) {
      if (expectFailure) return (e as { stdout?: string; stderr?: string }).stderr ?? "";
      throw e;
    }
  }

  it("prepare + transfer moves every legacy row to the new account, losslessly", async () => {
    const { path: dbPath, prisma, legacyId } = await legacyFixtureDb("migrate.db");

    const before = {
      types: await prisma.workoutType.count({ where: { userId: legacyId } }),
      exercises: await prisma.exercise.count({ where: { userId: legacyId } }),
      events: await prisma.workoutEvent.count({ where: { userId: legacyId } }),
      workouts: await prisma.workout.count({ where: { userId: legacyId } }),
      bodyWeightLogs: await prisma.bodyWeightLog.count({ where: { userId: legacyId } }),
      onboardingCompletedAt: (
        await prisma.userPreferences.findUnique({ where: { userId: legacyId } })
      )?.onboardingCompletedAt,
    };
    const legacy = { id: legacyId };
    expect(before.types).toBeGreaterThan(0);

    runScript(["prepare", "--db", dbPath]);
    expect(await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } })).toBeNull();

    // Real signup with the freed-up email (exercises the provisioning hook).
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Siv", email: LEGACY_EMAIL, password: "letmelift123" },
    });

    runScript(["transfer", "--to", LEGACY_EMAIL, "--db", dbPath]);

    const target = await prisma.user.findUniqueOrThrow({ where: { email: LEGACY_EMAIL } });
    expect(target.id).not.toBe(legacy.id);
    // Legacy user is gone; all rows now belong to the target.
    expect(await prisma.user.findUnique({ where: { id: legacy.id } })).toBeNull();
    expect(await prisma.workoutType.count({ where: { userId: target.id } })).toBe(before.types);
    expect(await prisma.exercise.count({ where: { userId: target.id } })).toBe(before.exercises);
    expect(await prisma.workoutEvent.count({ where: { userId: target.id } })).toBe(before.events);
    expect(await prisma.workout.count({ where: { userId: target.id } })).toBe(before.workouts);
    expect(await prisma.bodyWeightLog.count({ where: { userId: target.id } })).toBe(
      before.bodyWeightLogs
    );
    // Onboarding state survives — she is not sent back through the wizard.
    expect(
      (await prisma.userPreferences.findUnique({ where: { userId: target.id } }))
        ?.onboardingCompletedAt
    ).toEqual(before.onboardingCompletedAt);
    // No orphaned rows left under any other user.
    expect(await prisma.exercise.count({ where: { userId: { not: target.id } } })).toBe(0);
    // The credential is intact — she can still sign in.
    const signin = await auth.api.signInEmail({
      body: { email: LEGACY_EMAIL, password: "letmelift123" },
    });
    expect(signin.token).toBeTruthy();
  });

  it("refuses to transfer into an account that already has its own data", async () => {
    const { path: dbPath, prisma } = await legacyFixtureDb("refuse.db");
    runScript(["prepare", "--db", dbPath]);
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Siv", email: LEGACY_EMAIL, password: "letmelift123" },
    });
    // Give the new account data of its own.
    const target = await prisma.user.findUniqueOrThrow({ where: { email: LEGACY_EMAIL } });
    const anyType = await prisma.workoutType.findFirstOrThrow({ where: { userId: target.id } });
    await prisma.workoutEvent.create({
      data: {
        userId: target.id,
        workoutTypeId: anyType.id,
        scheduledDate: new Date(),
        status: "PLANNED",
        createdBy: "USER",
      },
    });

    const stderr = runScript(["transfer", "--to", LEGACY_EMAIL, "--db", dbPath], true);
    expect(stderr).toContain("refusing to merge");
  });

  it("refuses to treat a real signed-up account as the legacy user", async () => {
    // No pre-auth legacy row at all — just a real signup holding the email.
    const { prisma, path: dbPath } = await emptyDb("realaccount.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Siv", email: LEGACY_EMAIL, password: "letmelift123" },
    });

    const stderr = runScript(["prepare", "--db", dbPath], true);
    expect(stderr).toContain("Refusing to touch it");
    // The real account's email is untouched.
    expect(await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } })).not.toBeNull();
  });

  it("refuses to WRITE to production without explicit confirmation", () => {
    // --production selects the remote database; writing to it additionally
    // requires --confirm-production, so no destructive step can happen by
    // accident from a shell that happens to have Turso vars set.
    let failed = false;
    try {
      execFileSync("npx", ["tsx", script, "prepare", "--production"], {
        encoding: "utf8",
        env: { ...process.env, TURSO_DATABASE_URL: "libsql://example.turso.io" },
      });
    } catch (e) {
      failed = true;
      expect((e as { stderr?: string }).stderr).toContain("--confirm-production");
    }
    expect(failed).toBe(true);
  });

  it("inspect is read-only and never needs the production confirmation", () => {
    const dbPath = copyDevDb("inspect.db");
    // Local inspect against a copy: proves the command runs and reports
    // accounts without touching anything.
    const out = execFileSync("npx", ["tsx", script, "inspect", "--db", dbPath], {
      encoding: "utf8",
      env: { ...process.env, TURSO_DATABASE_URL: "" },
    });
    expect(out).toContain("Accounts");
  });

  it("inspect reports when no migration is needed", async () => {
    // A database whose only account has a real login needs no migration.
    const { path: dbPath, prisma } = await emptyDb("nomigration.db");
    const auth = authFor(prisma);
    await auth.api.signUpEmail({
      body: { name: "Siv", email: LEGACY_EMAIL, password: "letmelift123" },
    });
    const out = execFileSync("npx", ["tsx", script, "inspect", "--db", dbPath], {
      encoding: "utf8",
      env: { ...process.env, TURSO_DATABASE_URL: "" },
    });
    expect(out).toContain("NO MIGRATION NEEDED");
  });
});
