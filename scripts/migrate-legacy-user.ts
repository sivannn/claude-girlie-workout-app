/**
 * Moves data from the pre-auth "legacy" account onto a real signed-up account.
 *
 * Background: before Phase 1 there was no login — every row belonged to one
 * seeded user with no password. Signing up creates a fresh account with its
 * own provisioned exercise library, so the old data needs deliberately moving
 * across. History, goals, achievements, drafts and preferences all survive
 * with their original ids.
 *
 * ALWAYS START WITH `inspect` — it is read-only and tells you whether a
 * migration is needed at all.
 *
 *   npx tsx scripts/migrate-legacy-user.ts inspect                  # local
 *   npx tsx scripts/migrate-legacy-user.ts inspect --production     # Turso
 *
 * If it reports a pre-auth legacy account holding data, the migration is
 * three steps (run back-to-back — see the warning below):
 *
 *   1. prepare   — frees the legacy email so signup can use it
 *   2. (the person signs up through the app with that email)
 *   3. transfer --to <email>   — moves every row onto the new account
 *
 * When the new account uses a DIFFERENT email, skip step 1 entirely.
 *
 * Options:
 *   --db <path>            local SQLite file (default prisma/dev.db)
 *   --production           target TURSO_DATABASE_URL instead of a file
 *   --confirm-production   required to WRITE to production (inspect and
 *                          --dry-run never need it)
 *   --from <email>         legacy account email (default sivsivlevy@gmail.com)
 *   --to <email>           the real signed-up account to move data onto
 *   --dry-run              report what would change without changing anything
 *
 * TIMING WARNING: between `prepare` and the signup, the freed email is
 * claimable by anyone. Do the three steps in one sitting, and do not complete
 * onboarding on the new account before `transfer` — the transfer refuses a
 * target that already has data of its own.
 *
 * Take a database backup before the production run (`turso db shell <db>
 * .dump > backup.sql`).
 */
import path from "node:path";
import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const LEGACY_EMAIL_DEFAULT = "sivsivlevy@gmail.com";
const LEGACY_PREFIX = "legacy+";

type Args = {
  command: "inspect" | "prepare" | "transfer";
  db: string;
  from: string;
  to: string | null;
  dryRun: boolean;
  /** Target the remote Turso database in TURSO_DATABASE_URL instead of a file. */
  production: boolean;
  /** Required alongside --production for anything that writes. */
  confirmProduction: boolean;
};

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (command !== "inspect" && command !== "prepare" && command !== "transfer") {
    console.error(
      "Usage: migrate-legacy-user.ts <inspect|prepare|transfer> [--to <email>]\n" +
        "  [--db <path>] [--from <email>] [--dry-run] [--production] [--confirm-production]"
    );
    process.exit(1);
  }
  const args: Args = {
    command,
    db: path.join(process.cwd(), "prisma", "dev.db"),
    from: LEGACY_EMAIL_DEFAULT,
    to: null,
    dryRun: false,
    production: false,
    confirmProduction: false,
  };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--db") args.db = path.resolve(rest[++i]);
    else if (rest[i] === "--from") args.from = rest[++i];
    else if (rest[i] === "--to") args.to = rest[++i];
    else if (rest[i] === "--dry-run") args.dryRun = true;
    else if (rest[i] === "--production") args.production = true;
    else if (rest[i] === "--confirm-production") args.confirmProduction = true;
    else {
      console.error(`Unknown option: ${rest[i]}`);
      process.exit(1);
    }
  }
  return args;
}

const CHILD_TABLES = [
  "workoutType",
  "exercise",
  "exercisePreference",
  "goal",
  "workoutEvent",
  "workout",
  "achievement",
  "bodyWeightLog",
  "coachMemory",
  "coachInsight",
] as const;

async function countRows(prisma: PrismaClient, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of CHILD_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    counts[table] = await (prisma as any)[table].count({ where: { userId } });
  }
  counts.userPreferences = (await prisma.userPreferences.count({ where: { userId } })) as number;
  return counts;
}

/** Read-only summary: is a migration even needed, and what would move? */
async function inspect(prisma: PrismaClient, legacyEmail: string) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nAccounts (${users.length}):`);
  for (const u of users) {
    const [credentials, workouts, events, goals, exercises, prefs] = await Promise.all([
      prisma.account.count({ where: { userId: u.id } }),
      prisma.workout.count({ where: { userId: u.id } }),
      prisma.workoutEvent.count({ where: { userId: u.id } }),
      prisma.goal.count({ where: { userId: u.id } }),
      prisma.exercise.count({ where: { userId: u.id } }),
      prisma.userPreferences.findUnique({ where: { userId: u.id }, select: { onboardingCompletedAt: true } }),
    ]);
    console.log(
      `  ${u.email}\n` +
        `    login: ${credentials > 0 ? "yes" : "NO (pre-auth legacy account)"}` +
        `  onboarded: ${prefs?.onboardingCompletedAt ? "yes" : "no"}\n` +
        `    workouts: ${workouts}  calendar events: ${events}  goals: ${goals}  exercises: ${exercises}`
    );
  }

  const legacy =
    users.find((u) => u.email === `${LEGACY_PREFIX}${legacyEmail}`) ??
    users.find((u) => u.email === legacyEmail);
  if (!legacy) {
    console.log(`\nNo account matching ${legacyEmail} — nothing to migrate.`);
    return;
  }
  const legacyCredentials = await prisma.account.count({ where: { userId: legacy.id } });
  const legacyWorkouts = await prisma.workout.count({ where: { userId: legacy.id } });
  if (legacyCredentials > 0) {
    console.log(
      `\n${legacy.email} already has a login, so it is a real account, not the pre-auth ` +
        `legacy user. NO MIGRATION NEEDED.`
    );
    return;
  }
  console.log(
    `\nFound a pre-auth legacy account (${legacy.email}) holding ${legacyWorkouts} workout(s) ` +
      `and no login.\nA migration would move its data onto a real signed-up account.`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let prisma: PrismaClient;
  if (args.production) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      console.error("--production requires TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) in the environment.");
      process.exit(1);
    }
    // Writing to production is opt-in twice: --production to select it, and
    // --confirm-production to acknowledge it. Reading is always allowed.
    if (args.command !== "inspect" && !args.dryRun && !args.confirmProduction) {
      console.error(
        `Refusing to run '${args.command}' against production without --confirm-production.\n` +
          "Run 'inspect' first, then the same command with --dry-run, and only then add\n" +
          "--confirm-production. Take a database backup before the real run."
      );
      process.exit(1);
    }
    prisma = new PrismaClient({
      adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
    });
    console.log(`Database: REMOTE ${url}${args.dryRun ? "  (dry run)" : ""}`);
  } else {
    if (!fs.existsSync(args.db)) {
      console.error(`Database file not found: ${args.db}`);
      process.exit(1);
    }
    prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: args.db }) });
    console.log(`Database: ${args.db}${args.dryRun ? "  (dry run)" : ""}`);
  }

  if (args.command === "inspect") {
    await inspect(prisma, args.from);
    return;
  }

  // After `prepare` + signup, the ORIGINAL email belongs to the new account
  // and the legacy row carries the legacy+ prefix — so the prefixed row, when
  // present, is always the legacy one.
  const legacy =
    (await prisma.user.findUnique({ where: { email: `${LEGACY_PREFIX}${args.from}` } })) ??
    (await prisma.user.findUnique({ where: { email: args.from } }));
  if (!legacy) {
    console.error(`No legacy user found for ${args.from} (or ${LEGACY_PREFIX}${args.from}).`);
    process.exit(1);
  }
  // The pre-auth legacy account is exactly the one with no login credential.
  // Refuse to treat a real signed-up account as "legacy" — renaming or
  // draining a live account must be impossible no matter what was passed in.
  const legacyCredentials = await prisma.account.count({ where: { userId: legacy.id } });
  if (legacyCredentials > 0) {
    console.error(
      `${legacy.email} has a login credential, so it is a real account, not the pre-auth ` +
        "legacy user. Refusing to touch it."
    );
    process.exit(1);
  }

  if (args.command === "prepare") {
    if (legacy.email.startsWith(LEGACY_PREFIX)) {
      console.log(`Already prepared: legacy user's email is ${legacy.email}.`);
      return;
    }
    const freed = `${LEGACY_PREFIX}${legacy.email}`;
    if (args.dryRun) {
      console.log(`Would rename legacy user ${legacy.id} email: ${legacy.email} -> ${freed}`);
      return;
    }
    await prisma.user.update({ where: { id: legacy.id }, data: { email: freed } });
    console.log(`Legacy email freed: ${legacy.email} -> ${freed}`);
    console.log("Now sign up through the app with the original email, then run the transfer step.");
    return;
  }

  // ---- transfer ----
  if (!args.to) {
    console.error("transfer requires --to <email of the new signed-up account>");
    process.exit(1);
  }
  const target = await prisma.user.findUnique({ where: { email: args.to } });
  if (!target) {
    console.error(`No account found for ${args.to} — sign up through the app first.`);
    process.exit(1);
  }
  if (target.id === legacy.id) {
    console.error("Target and legacy accounts are the same user; nothing to transfer.");
    process.exit(1);
  }
  const targetCredentials = await prisma.account.count({ where: { userId: target.id } });
  if (targetCredentials === 0) {
    console.error(`Target ${args.to} has no credential account — it doesn't look like a real signup.`);
    process.exit(1);
  }

  // The target must be a pristine account: provisioned library only, no
  // logged data. Refuse to merge into an account that already has history.
  const targetData = await Promise.all([
    prisma.workout.count({ where: { userId: target.id } }),
    prisma.workoutEvent.count({ where: { userId: target.id } }),
    prisma.goal.count({ where: { userId: target.id } }),
    prisma.achievement.count({ where: { userId: target.id } }),
    prisma.bodyWeightLog.count({ where: { userId: target.id } }),
  ]);
  if (targetData.some((n) => n > 0)) {
    console.error(
      "Target account already has workout data of its own — refusing to merge. " +
        "Transfer expects a freshly signed-up account."
    );
    process.exit(1);
  }

  const legacyCounts = await countRows(prisma, legacy.id);
  console.log("Legacy rows to move:", JSON.stringify(legacyCounts));
  if (args.dryRun) {
    console.log(`Would delete target's provisioned library and move all rows ${legacy.id} -> ${target.id}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Clear the target's provisioned starter library (pristine, no
    //    history references it — verified above).
    await tx.exercisePreference.deleteMany({ where: { userId: target.id } });
    await tx.exercise.deleteMany({ where: { userId: target.id } });
    await tx.workoutType.deleteMany({ where: { userId: target.id } });
    await tx.userPreferences.deleteMany({ where: { userId: target.id } });

    // 2. Move every legacy row. GoalMilestone / WorkoutExercise / WorkoutSet
    //    hang off these parents and follow automatically.
    for (const table of CHILD_TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any)[table].updateMany({
        where: { userId: legacy.id },
        data: { userId: target.id },
      });
    }
    await tx.userPreferences.updateMany({
      where: { userId: legacy.id },
      data: { userId: target.id },
    });

    // 3. The legacy user is now childless — remove it.
    await tx.user.delete({ where: { id: legacy.id } });
  });

  const targetCounts = await countRows(prisma, target.id);
  console.log("Target rows after move:", JSON.stringify(targetCounts));
  const mismatches = Object.entries(legacyCounts).filter(([k, v]) => targetCounts[k] !== v);
  if (mismatches.length > 0) {
    console.error("WARNING — row-count mismatches after transfer:", mismatches);
    process.exit(1);
  }
  const legacyRemains = await prisma.user.findUnique({ where: { id: legacy.id } });
  console.log(
    legacyRemains
      ? "WARNING — legacy user row still present!"
      : `Transfer complete: all data now belongs to ${target.email} (${target.id}).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
