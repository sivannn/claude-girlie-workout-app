import type { PrismaClient } from "@/generated/prisma/client";
import { EXERCISE_LIBRARY, type ExerciseSeed } from "@/lib/data/exercises";
import { EXERCISE_INSTRUCTIONS } from "@/lib/data/exercise-instructions";
import { WORKOUT_TYPE_LIBRARY } from "@/lib/data/workout-types";

/**
 * Library row shape, including the periodization tags and the seeded
 * how-to text (so the Info button never has to call the AI for a library
 * exercise, and never caches a generic fallback when the API is down).
 */
function exerciseFields(ex: ExerciseSeed) {
  return {
    name: ex.name,
    workoutCategory: ex.workoutCategory,
    movementCategory: ex.movementCategory,
    kind: ex.kind,
    repRangeLow: ex.repRangeLow,
    repRangeHigh: ex.repRangeHigh,
    defaultIncrementLb: ex.defaultIncrementLb,
    equipment: ex.equipment,
    perSideWeight: ex.perSideWeight,
    perSideReps: ex.perSideReps,
    muscleGroup: ex.muscleGroup,
    exerciseType: ex.exerciseType,
    difficultyTier: ex.difficultyTier,
    contraindications: JSON.stringify(ex.contraindications),
    instructions: EXERCISE_INSTRUCTIONS[ex.name] ?? null,
  };
}

// WorkoutType and Exercise are per-user rows (see prisma/schema.prisma), so
// every account needs its own copy of the library before the app can
// recommend anything. Runs from two places:
//   - the Better Auth signup hook (src/lib/auth-server.ts) for new accounts
//   - prisma/seed.ts for the local dev account
//
// Deliberately NOT "server-only": prisma/seed.ts runs it under plain tsx.

export type ProvisioningOptions = {
  /**
   * Movement categories whose exercises get HIGH priority instead of MEDIUM
   * (used by the dev seed to preserve the original hand-tuned preferences;
   * real signups start neutral and let usage adjust priorities over time).
   */
  highPriorityMovementCategories?: Set<string>;
};

/**
 * Idempotently provisions a user's workout-type/exercise library plus a
 * default UserPreferences row (onboarding's completeOnboarding does an
 * `update`, so the row must exist before the wizard finishes).
 *
 * Brand-new users (the signup path) take a bulk-insert fast path — one
 * createMany per table instead of per-row upserts — which matters on Turso,
 * where every query is a network round trip. Existing users (re-seeding after
 * a library change) fall back to per-row upserts that refresh library-managed
 * fields without touching user customizations or history.
 */
export async function provisionUserLibrary(
  prisma: PrismaClient,
  userId: string,
  options: ProvisioningOptions = {}
): Promise<void> {
  const highPriority = options.highPriorityMovementCategories ?? new Set<string>();

  const existingTypeCount = await prisma.workoutType.count({ where: { userId } });
  if (existingTypeCount === 0) {
    await prisma.workoutType.createMany({
      data: WORKOUT_TYPE_LIBRARY.map((wt) => ({
        userId,
        name: wt.name,
        category: wt.category,
        colorKey: wt.colorKey,
        requiresRecommendation: wt.requiresRecommendation,
        isCustom: false,
      })),
    });
  } else {
    for (const wt of WORKOUT_TYPE_LIBRARY) {
      await prisma.workoutType.upsert({
        where: { userId_name: { userId, name: wt.name } },
        update: {
          category: wt.category,
          colorKey: wt.colorKey,
          requiresRecommendation: wt.requiresRecommendation,
        },
        create: {
          userId,
          name: wt.name,
          category: wt.category,
          colorKey: wt.colorKey,
          requiresRecommendation: wt.requiresRecommendation,
          isCustom: false,
        },
      });
    }
  }

  const existingExerciseCount = await prisma.exercise.count({ where: { userId } });
  if (existingExerciseCount === 0) {
    await prisma.exercise.createMany({
      data: EXERCISE_LIBRARY.map((ex) => ({
        userId,
        ...exerciseFields(ex),
        isCustom: false,
      })),
    });
  } else {
    for (const ex of EXERCISE_LIBRARY) {
      const fields = exerciseFields(ex);
      await prisma.exercise.upsert({
        where: { userId_name: { userId, name: ex.name } },
        update: fields,
        create: { userId, ...fields, isCustom: false },
      });
    }
  }

  // One ExercisePreference per library exercise (the selection engine's
  // learning signal). createMany can't skip duplicates on SQLite, so filter
  // against what already exists.
  const exercises = await prisma.exercise.findMany({
    where: { userId, isCustom: false },
    select: { id: true, movementCategory: true },
  });
  const existingPrefs = await prisma.exercisePreference.findMany({
    where: { userId },
    select: { exerciseId: true },
  });
  const alreadyPreferred = new Set(existingPrefs.map((p) => p.exerciseId));
  const missingPrefs = exercises.filter((ex) => !alreadyPreferred.has(ex.id));
  if (missingPrefs.length > 0) {
    await prisma.exercisePreference.createMany({
      data: missingPrefs.map((ex) => ({
        userId,
        exerciseId: ex.id,
        priority: highPriority.has(ex.movementCategory) ? "HIGH" : "MEDIUM",
      })),
    });
  }

  // LAST on purpose: the preferences row doubles as the "provisioning
  // completed" marker. If any earlier step fails (signup hooks are not
  // transactional), the row stays absent and getCurrentUser retries the whole
  // idempotent provisioning on the next request instead of leaving the
  // account permanently half-set-up.
  await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      weeklyLegDayTarget: 1,
      weeklyUpperBodyTarget: 1,
      weeklyCardioTarget: 1,
      weeklyFunTarget: 1,
      monthlyWorkoutTarget: 18,
      unitSystem: "imperial",
    },
  });
}
