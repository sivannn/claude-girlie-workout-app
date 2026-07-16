import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { EXERCISE_LIBRARY } from "../src/lib/data/exercises";
import { WORKOUT_TYPE_LIBRARY } from "../src/lib/data/workout-types";

// Same env-driven adapter choice as src/lib/prisma.ts, so `npm run db:seed`
// can target either the local dev.db or the deployed Turso database.
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
// the user's stated top fitness priority — seeded as HIGH priority so the
// exercise-selection engine favors them from day one.
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

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      weeklyLegDayTarget: 1,
      weeklyUpperBodyTarget: 1,
      weeklyCardioTarget: 1,
      weeklyFunTarget: 1,
      monthlyWorkoutTarget: 18,
      unitSystem: "imperial",
      topPriorityCategory: "glutes_legs",
    },
  });
  console.log("User preferences ready.");

  for (const wt of WORKOUT_TYPE_LIBRARY) {
    await prisma.workoutType.upsert({
      where: { userId_name: { userId: user.id, name: wt.name } },
      update: {
        category: wt.category,
        colorKey: wt.colorKey,
        requiresRecommendation: wt.requiresRecommendation,
      },
      create: {
        userId: user.id,
        name: wt.name,
        category: wt.category,
        colorKey: wt.colorKey,
        requiresRecommendation: wt.requiresRecommendation,
        isCustom: false,
      },
    });
  }
  console.log(`Seeded ${WORKOUT_TYPE_LIBRARY.length} workout types.`);

  for (const ex of EXERCISE_LIBRARY) {
    const exercise = await prisma.exercise.upsert({
      where: { userId_name: { userId: user.id, name: ex.name } },
      update: {
        workoutCategory: ex.workoutCategory,
        movementCategory: ex.movementCategory,
        kind: ex.kind,
        repRangeLow: ex.repRangeLow,
        repRangeHigh: ex.repRangeHigh,
        defaultIncrementLb: ex.defaultIncrementLb,
        equipment: ex.equipment,
      },
      create: {
        userId: user.id,
        name: ex.name,
        workoutCategory: ex.workoutCategory,
        movementCategory: ex.movementCategory,
        kind: ex.kind,
        repRangeLow: ex.repRangeLow,
        repRangeHigh: ex.repRangeHigh,
        defaultIncrementLb: ex.defaultIncrementLb,
        equipment: ex.equipment,
        isCustom: false,
      },
    });

    await prisma.exercisePreference.upsert({
      where: { userId_exerciseId: { userId: user.id, exerciseId: exercise.id } },
      update: {},
      create: {
        userId: user.id,
        exerciseId: exercise.id,
        priority: HIGH_PRIORITY_MOVEMENT_CATEGORIES.has(ex.movementCategory)
          ? "HIGH"
          : "MEDIUM",
      },
    });
  }
  console.log(`Seeded ${EXERCISE_LIBRARY.length} exercises.`);
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
