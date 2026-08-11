/**
 * Attaches all data from the legacy hardcoded-email account to a real
 * Better Auth account, losslessly.
 *
 * Background: before auth existed, every row belonged to one seeded user
 * (sivsivlevy@gmail.com). Signing up provisions a FRESH library, and all
 * legacy workouts/goals reference the LEGACY account's exercise rows — so the
 * transfer deletes the new account's pristine provisioned library and moves
 * every legacy row (library included) to the new account instead. History,
 * goals, achievements, drafts, and preferences all survive with their
 * original ids.
 *
 * Usage (three steps when reusing the same email):
 *   1. npx tsx scripts/migrate-legacy-user.ts prepare
 *      — frees the legacy email (renames it to legacy+<email>) so signup can use it
 *   2. Sign up through the app with the original email
 *   3. npx tsx scripts/migrate-legacy-user.ts transfer --to sivsivlevy@gmail.com
 *
 * Or, when the new account uses a different email, skip `prepare`:
 *   npx tsx scripts/migrate-legacy-user.ts transfer --to newemail@example.com
 *
 * Options:
 *   --db <path>    target a specific SQLite file (default prisma/dev.db) —
 *                  use this to rehearse against a COPY first
 *   --from <email> legacy account email (default sivsivlevy@gmail.com,
 *                  also matched with the legacy+ prefix)
 *   --dry-run      report what would move without changing anything
 *
 * PRODUCTION GATE: refuses to run when TURSO_DATABASE_URL is set. The
 * production migration is a separately approved step (see the Phase 1
 * checkpoint report); this gate comes out only when that approval lands.
 */
import path from "node:path";
import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const LEGACY_EMAIL_DEFAULT = "sivsivlevy@gmail.com";
const LEGACY_PREFIX = "legacy+";

if (process.env.TURSO_DATABASE_URL) {
  console.error(
    "Refusing to run: TURSO_DATABASE_URL is set, which points at a remote " +
      "(production-class) database. The Phase 1 gate forbids running this " +
      "migration against production. Unset the variable to run locally."
  );
  process.exit(1);
}

type Args = {
  command: "prepare" | "transfer";
  db: string;
  from: string;
  to: string | null;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (command !== "prepare" && command !== "transfer") {
    console.error("Usage: migrate-legacy-user.ts <prepare|transfer> [--to <email>] [--db <path>] [--from <email>] [--dry-run]");
    process.exit(1);
  }
  const args: Args = {
    command,
    db: path.join(process.cwd(), "prisma", "dev.db"),
    from: LEGACY_EMAIL_DEFAULT,
    to: null,
    dryRun: false,
  };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--db") args.db = path.resolve(rest[++i]);
    else if (rest[i] === "--from") args.from = rest[++i];
    else if (rest[i] === "--to") args.to = rest[++i];
    else if (rest[i] === "--dry-run") args.dryRun = true;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.db)) {
    console.error(`Database file not found: ${args.db}`);
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: args.db }) });
  console.log(`Database: ${args.db}${args.dryRun ? "  (dry run)" : ""}`);

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
