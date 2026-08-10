import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { provisionUserLibrary } from "../src/lib/data/provisioning";

// DEV-ONLY convenience: sets up a local account with the workout-type and
// exercise library so the app is usable immediately after cloning. Real
// accounts are provisioned automatically at signup (src/lib/auth-server.ts's
// databaseHooks). This seeded account has no password and its email blocks
// signup (emails are unique) — to turn it into a real login, run
// `npx tsx scripts/migrate-legacy-user.ts prepare`, sign up with this email
// through the UI, then run the script's `transfer` step (see its header).
//
// Same env-driven adapter choice as src/lib/prisma.ts, so `npm run db:seed`
// can target either the local dev.db or a Turso database.
const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : new PrismaBetterSqlite3({
      url: path.join(process.cwd(), "prisma", "dev.db"),
    });
const prisma = new PrismaClient({ adapter });

const DEFAULT_USER_EMAIL = "sivsivlevy@gmail.com";

// Exercises in these movement categories most directly serve glute growth,
// the original user's stated top fitness priority — seeded as HIGH priority so
// the exercise-selection engine favors them from day one.
const HIGH_PRIORITY_MOVEMENT_CATEGORIES = new Set([
  "hip_thrust_bridge",
  "glute_abduction",
  "glute_isolation",
]);

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: "Siv" },
  });
  console.log(`User ready: ${user.id}`);

  await provisionUserLibrary(prisma, user.id, {
    highPriorityMovementCategories: HIGH_PRIORITY_MOVEMENT_CATEGORIES,
  });

  // Only on first seed — re-seeding must not clobber a priority the user has
  // since changed through onboarding (matches the old upsert's update: {}).
  await prisma.userPreferences.updateMany({
    where: { userId: user.id, topPriorityCategory: null },
    data: { topPriorityCategory: "glutes_legs" },
  });
  console.log("Library and preferences provisioned.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
