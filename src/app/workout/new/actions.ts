"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decideCardioProgression,
  decideProgression,
  estimateStartingWeight,
  generateWeightliftingWorkout,
  trainingCategoryForWorkoutType,
} from "@/lib/engine";
import type {
  EngineExercise,
  EngineExercisePreference,
  EngineExerciseSession,
  EngineWorkoutType,
} from "@/lib/engine/types";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import { weeklyGoalBucketForWorkoutType } from "@/lib/data/workout-types";
import { filterExercisesByEquipment } from "@/lib/data/equipment";
import type { EquipmentAccess, ExperienceLevel, MovementCategory, WorkoutCategory } from "@/lib/types/enums";
import { generateWorkoutBrief, generateWorkoutRecap } from "@/lib/ai/alex";
import type {
  CompleteWorkoutPayload,
  GeneratedExerciseView,
  GeneratedSessionData,
  WorkoutRecapResult,
} from "./types";

const RECENT_SESSIONS_LIMIT = 5;

async function getExerciseHistories(
  userId: string,
  exerciseIds: string[]
): Promise<Map<string, EngineExerciseSession[]>> {
  if (exerciseIds.length === 0) return new Map();

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: { exerciseId: { in: exerciseIds }, workout: { userId } },
    include: { sets: true, workout: { select: { date: true } } },
    orderBy: { workout: { date: "desc" } },
  });

  const byExercise = new Map<string, EngineExerciseSession[]>();
  for (const we of workoutExercises) {
    const list = byExercise.get(we.exerciseId) ?? [];
    if (list.length >= RECENT_SESSIONS_LIMIT) continue;
    list.push({
      date: we.workout.date,
      sets: we.sets.map((s) => ({
        setNumber: s.setNumber,
        recommendedWeight: s.recommendedWeight,
        actualWeight: s.actualWeight,
        recommendedRepsLow: s.recommendedRepsLow,
        recommendedRepsHigh: s.recommendedRepsHigh,
        actualReps: s.actualReps,
      })),
    });
    byExercise.set(we.exerciseId, list);
  }
  return byExercise;
}

function formatSessionSummary(session: EngineExerciseSession | undefined): string | null {
  if (!session) return null;
  const parts = session.sets
    .filter((s) => s.actualWeight != null && s.actualReps != null)
    .map((s) => `${s.actualWeight} × ${s.actualReps}`);
  return parts.length ? parts.join(", ") : null;
}

async function getRecentPicks(userId: string, workoutTypeId: string, limit = 4) {
  const recentWorkouts = await prisma.workout.findMany({
    where: { userId, workoutTypeId },
    orderBy: { date: "desc" },
    take: limit,
    include: { exercises: true },
  });
  return recentWorkouts.flatMap((w) =>
    w.exercises.map((we) => ({
      movementCategory: we.movementCategory as MovementCategory,
      exerciseId: we.exerciseId,
      date: w.date,
    }))
  );
}

async function getLongTermGoals(userId: string, exerciseIds: string[]) {
  const goals = await prisma.goal.findMany({
    where: { userId, exerciseId: { in: exerciseIds }, status: "ACTIVE" },
  });
  const map = new Map<string, string>();
  for (const g of goals) {
    if (g.exerciseId) map.set(g.exerciseId, `${g.targetValue} ${g.unit}`);
  }
  return map;
}

function toExerciseView(
  generated: {
    exercise: EngineExercise;
    movementCategory: MovementCategory;
    selectionReason: string;
    progressionReason: string;
    isDeload: boolean;
    isFirstTime: boolean;
    warmup: { weight: number | null; reps: number | null };
    workingSets: Array<{ setNumber: number; weight: number | null; repsLow: number; repsHigh: number }>;
  },
  histories: Map<string, EngineExerciseSession[]>,
  goals: Map<string, string>
): GeneratedExerciseView {
  return {
    exerciseId: generated.exercise.id,
    name: generated.exercise.name,
    movementCategory: generated.movementCategory,
    movementCategoryLabel: movementCategoryLabel(generated.movementCategory),
    selectionReason: generated.selectionReason,
    progressionReason: generated.progressionReason,
    isDeload: generated.isDeload,
    isFirstTime: generated.isFirstTime,
    lastWorkoutSummary: formatSessionSummary(histories.get(generated.exercise.id)?.[0]),
    longTermGoal: goals.get(generated.exercise.id) ?? null,
    warmup: generated.warmup,
    workingSets: generated.workingSets.map((s) => ({
      setNumber: s.setNumber,
      recommendedWeight: s.weight,
      recommendedRepsLow: s.repsLow,
      recommendedRepsHigh: s.repsHigh,
    })),
  };
}

export async function generateWorkoutForType(workoutTypeId: string): Promise<GeneratedSessionData> {
  const user = await getCurrentUser();
  const workoutType = await prisma.workoutType.findFirstOrThrow({
    where: { id: workoutTypeId, userId: user.id },
  });

  const base = {
    workoutTypeId: workoutType.id,
    workoutTypeName: workoutType.name,
    colorKey: workoutType.colorKey,
  };

  if (!workoutType.requiresRecommendation) {
    return { mode: "simple", ...base };
  }

  if (workoutType.category === "CARDIO") {
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: user.id, workoutTypeId: workoutType.id },
      orderBy: { date: "desc" },
      take: RECENT_SESSIONS_LIMIT,
    });
    const recommendation = decideCardioProgression(
      recentWorkouts.map((w) => ({
        date: w.date,
        timeSeconds: w.cardioTimeSeconds,
        distanceMiles: w.cardioDistanceMiles,
      }))
    );
    return {
      mode: "cardio",
      ...base,
      reason: recommendation.reason,
      recommendedDistanceMiles: recommendation.recommendedDistanceMiles,
      recommendedTimeSeconds: recommendation.recommendedTimeSeconds,
    };
  }

  // Weightlifting
  const trainingCategory = trainingCategoryForWorkoutType(workoutType as EngineWorkoutType);
  if (!trainingCategory) {
    return { mode: "simple", ...base };
  }

  const [liftingExercisesRaw, abExercisesRaw, preferences, recentPicks] = await Promise.all([
    prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: trainingCategory } }),
    prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: "abs" } }),
    prisma.exercisePreference.findMany({ where: { userId: user.id } }),
    getRecentPicks(user.id, workoutType.id),
  ]);
  // Ab picks share the same recent workouts of this type.
  const recentAbPicks = recentPicks;

  const equipmentAccess = user.preferences?.equipmentAccess as EquipmentAccess | null | undefined;
  const liftingExercises = filterExercisesByEquipment(liftingExercisesRaw, equipmentAccess);
  const abExercises = filterExercisesByEquipment(abExercisesRaw, equipmentAccess);

  const allExerciseIds = [...liftingExercises, ...abExercises].map((e) => e.id);
  const [histories, goals] = await Promise.all([
    getExerciseHistories(user.id, allExerciseIds),
    getLongTermGoals(user.id, allExerciseIds),
  ]);

  const startingWeightHints = new Map<string, number>();
  for (const ex of [...liftingExercises, ...abExercises]) {
    if (!histories.get(ex.id)?.length) {
      startingWeightHints.set(
        ex.id,
        estimateStartingWeight(
          ex.movementCategory as MovementCategory,
          user.preferences?.experienceLevel as ExperienceLevel | null | undefined,
          user.preferences?.bodyWeightLb
        )
      );
    }
  }

  const generated = generateWeightliftingWorkout({
    trainingCategory,
    availableExercises: liftingExercises as EngineExercise[],
    abExercises: abExercises as EngineExercise[],
    preferences: preferences as EngineExercisePreference[],
    recentPicks,
    recentAbPicks,
    exerciseHistories: histories,
    startingWeightHints,
    asOfDate: new Date(),
  });

  const exercises = generated.exercises.map((e) => toExerciseView(e, histories, goals));
  const abExercise = generated.abExercise ? toExerciseView(generated.abExercise, histories, goals) : null;

  const previousPickIds = new Set(recentPicks.map((p) => p.exerciseId));
  const substitutions = generated.exercises
    .filter((e) => e.isRequiredSlot && !e.isFirstTime && !previousPickIds.has(e.exercise.id))
    .map((e) => {
      const prior = recentPicks.find((p) => p.movementCategory === e.movementCategory);
      return prior ? { from: prior.exerciseId, to: e.exercise.name } : null;
    })
    .filter((s): s is { from: string; to: string } => s !== null);

  // Resolve prior exercise IDs to names for the brief.
  const priorNames = new Map(
    (
      await prisma.exercise.findMany({
        where: { id: { in: substitutions.map((s) => s.from) } },
        select: { id: true, name: true },
      })
    ).map((e) => [e.id, e.name])
  );

  const brief = await generateWorkoutBrief({
    workoutTypeName: workoutType.name,
    focus:
      user.preferences?.topPriorityCategory === trainingCategory
        ? `progressing your ${workoutType.name.toLowerCase()} training toward your top priority`
        : `steady progression and balanced training for ${workoutType.name}`,
    progressed: exercises.filter((e) => !e.isFirstTime && !e.isDeload && /adds|hit the top/.test(e.progressionReason)).map((e) => e.name),
    held: exercises.filter((e) => !e.isFirstTime && /same weight/.test(e.progressionReason)).map((e) => e.name),
    substitutions: substitutions.map((s) => ({ from: priorNames.get(s.from) ?? "a previous exercise", to: s.to })),
  });

  return { mode: "weightlifting", ...base, brief, exercises, abExercise };
}

/** Candidate exercises for the "add a different exercise" picker. */
export async function getExerciseOptions(
  workoutCategory: string,
  excludeIds: string[]
): Promise<Array<{ id: string; name: string; movementCategoryLabel: string }>> {
  const user = await getCurrentUser();
  const exercises = await prisma.exercise.findMany({
    where: { userId: user.id, workoutCategory, id: { notIn: excludeIds } },
    orderBy: { name: "asc" },
  });
  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    movementCategoryLabel: movementCategoryLabel(e.movementCategory as MovementCategory),
  }));
}

/** Generates a progression preview for an exercise added manually mid-flow. */
export async function previewExerciseProgression(exerciseId: string): Promise<GeneratedExerciseView> {
  const user = await getCurrentUser();
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { id: exerciseId, userId: user.id },
  });
  const [histories, goals] = await Promise.all([
    getExerciseHistories(user.id, [exerciseId]),
    getLongTermGoals(user.id, [exerciseId]),
  ]);

  const history = histories.get(exerciseId) ?? [];
  const startingWeightHint = history.length
    ? undefined
    : estimateStartingWeight(
        exercise.movementCategory as MovementCategory,
        user.preferences?.experienceLevel as ExperienceLevel | null | undefined,
        user.preferences?.bodyWeightLb
      );
  const decision = decideProgression(exercise as EngineExercise, history, new Date(), startingWeightHint);

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    movementCategory: exercise.movementCategory,
    movementCategoryLabel: movementCategoryLabel(exercise.movementCategory as MovementCategory),
    selectionReason: "Added manually to today's workout.",
    progressionReason: decision.reason,
    isDeload: decision.isDeload,
    isFirstTime: decision.isFirstTime,
    lastWorkoutSummary: formatSessionSummary(history[0]),
    longTermGoal: goals.get(exerciseId) ?? null,
    warmup: { weight: decision.warmupWeight, reps: decision.warmupReps },
    workingSets: [1, 2, 3].map((setNumber) => ({
      setNumber,
      recommendedWeight: decision.recommendedWeight,
      recommendedRepsLow: decision.recommendedRepsLow,
      recommendedRepsHigh: decision.recommendedRepsHigh,
    })),
  };
}

export async function createCustomWorkoutType(input: {
  name: string;
  category: WorkoutCategory;
}): Promise<{ id: string; colorKey: string }> {
  const user = await getCurrentUser();
  const colorKeyByCategory: Record<WorkoutCategory, string> = {
    WEIGHTLIFTING: "custom_weightlifting",
    CARDIO: "custom_cardio",
    FUN: "custom_fun",
    RECOVERY: "custom_recovery",
  };
  const type = await prisma.workoutType.create({
    data: {
      userId: user.id,
      name: input.name,
      category: input.category,
      colorKey: colorKeyByCategory[input.category],
      isCustom: true,
      requiresRecommendation: false,
    },
  });
  return { id: type.id, colorKey: type.colorKey };
}

// ---------------------------------------------------------------------------
// Workout completion
// ---------------------------------------------------------------------------

export async function completeWorkout(
  payload: CompleteWorkoutPayload
): Promise<WorkoutRecapResult> {
  const user = await getCurrentUser();
  const workoutType = await prisma.workoutType.findFirstOrThrow({
    where: { id: payload.workoutTypeId, userId: user.id },
  });
  const now = new Date();

  if (payload.mode === "weightlifting") {
    return completeWeightliftingWorkout(user.id, workoutType.id, workoutType.name, payload, now);
  }
  if (payload.mode === "cardio") {
    return completeCardioWorkout(user.id, workoutType.id, workoutType.name, payload, now);
  }
  return completeSimpleWorkout(user.id, workoutType.id, workoutType.name, payload, now);
}

async function createCompletedEvent(userId: string, workoutTypeId: string, workoutId: string, date: Date) {
  await prisma.workoutEvent.create({
    data: {
      userId,
      workoutTypeId,
      workoutId,
      scheduledDate: date,
      status: "COMPLETED",
      createdBy: "USER",
    },
  });
}

async function completeWeightliftingWorkout(
  userId: string,
  workoutTypeId: string,
  workoutTypeName: string,
  payload: Extract<CompleteWorkoutPayload, { mode: "weightlifting" }>,
  now: Date
): Promise<WorkoutRecapResult> {
  const exerciseIds = payload.exercises.map((e) => e.exerciseId);
  const [priorBests, histories, exerciseRows, user] = await Promise.all([
    getPriorBestWeights(userId, exerciseIds),
    getExerciseHistories(userId, exerciseIds),
    prisma.exercise.findMany({ where: { id: { in: exerciseIds } } }),
    getCurrentUser(),
  ]);
  const exerciseNameById = new Map(exerciseRows.map((e) => [e.id, e.name]));

  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: now,
      durationMinutes: payload.durationMinutes,
      exercises: {
        create: payload.exercises.map((e, index) => ({
          exerciseId: e.exerciseId,
          orderIndex: index,
          movementCategory: e.movementCategory,
          reasonSelected: e.reasonSelected,
          warmupWeight: e.warmupWeight,
          warmupReps: e.warmupReps,
          sets: {
            create: e.sets.map((s) => ({
              setNumber: s.setNumber,
              recommendedWeight: s.recommendedWeight,
              actualWeight: s.actualWeight,
              recommendedRepsLow: s.recommendedRepsLow,
              recommendedRepsHigh: s.recommendedRepsHigh,
              actualReps: s.actualReps,
              matchedRecommendation:
                s.actualWeight != null &&
                s.actualReps != null &&
                s.recommendedWeight != null &&
                s.actualWeight >= s.recommendedWeight &&
                s.actualReps >= s.recommendedRepsLow,
            })),
          },
        })),
      },
    },
  });

  await createCompletedEvent(userId, workoutTypeId, workout.id, now);

  // Learning signal: bump selection counts for exercises actually kept in this workout.
  await Promise.all(
    payload.exercises.map((e) =>
      prisma.exercisePreference.upsert({
        where: { userId_exerciseId: { userId, exerciseId: e.exerciseId } },
        update: { timesSelected: { increment: 1 } },
        create: { userId, exerciseId: e.exerciseId, timesSelected: 1 },
      })
    )
  );

  // Learning signal: exercises the coach recommended but the user removed.
  await Promise.all(
    payload.removedExerciseIds.map((exerciseId) =>
      prisma.exercisePreference.upsert({
        where: { userId_exerciseId: { userId, exerciseId } },
        update: { timesRemoved: { increment: 1 } },
        create: { userId, exerciseId, timesRemoved: 1 },
      })
    )
  );

  const prsAchieved: string[] = [];
  const improvements: string[] = [];
  let totalVolumeLb = 0;

  for (const e of payload.exercises) {
    const actualSets = e.sets.filter((s) => s.actualWeight != null && s.actualReps != null);
    if (actualSets.length === 0) continue;
    const sessionBest = Math.max(...actualSets.map((s) => s.actualWeight!));
    const priorBest = priorBests.get(e.exerciseId) ?? 0;
    const name = exerciseNameById.get(e.exerciseId) ?? "Exercise";

    for (const s of actualSets) {
      totalVolumeLb += s.actualWeight! * s.actualReps!;
    }

    if (sessionBest > priorBest) {
      prsAchieved.push(`${name}: new best of ${sessionBest} lb`);
      await prisma.achievement.create({
        data: {
          userId,
          type: "PR",
          title: `${name} PR: ${sessionBest} lb`,
          description: `New heaviest working weight for ${name}.`,
          relatedExerciseId: e.exerciseId,
          relatedWorkoutId: workout.id,
          achievedAt: now,
        },
      });
      await applyGoalProgress(userId, e.exerciseId, sessionBest, now, workout.id);
    } else {
      const lastSession = histories.get(e.exerciseId)?.[0];
      const lastBest = lastSession
        ? Math.max(
            0,
            ...lastSession.sets.filter((s) => s.actualWeight != null).map((s) => s.actualWeight!)
          )
        : 0;
      if (lastSession && sessionBest > lastBest) {
        improvements.push(`${name} up to ${sessionBest} lb from ${lastBest} lb last session`);
      }
    }
  }

  const recap = await generateWorkoutRecap({
    workoutTypeName,
    prsAchieved,
    improvements,
    totalVolumeLb: totalVolumeLb || null,
    goalContext:
      user.preferences?.topPriorityCategory && prsAchieved.length
        ? "this keeps building toward your top training priority"
        : null,
  });

  await prisma.workout.update({ where: { id: workout.id }, data: { aiRecapText: recap } });

  return { recap, prsAchieved };
}

async function getPriorBestWeights(userId: string, exerciseIds: string[]): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map();
  const sets = await prisma.workoutSet.findMany({
    where: {
      actualWeight: { not: null },
      workoutExercise: { exerciseId: { in: exerciseIds }, workout: { userId } },
    },
    include: { workoutExercise: { select: { exerciseId: true } } },
  });
  const bests = new Map<string, number>();
  for (const s of sets) {
    const exId = s.workoutExercise.exerciseId;
    const current = bests.get(exId) ?? 0;
    if (s.actualWeight! > current) bests.set(exId, s.actualWeight!);
  }
  return bests;
}

async function applyGoalProgress(
  userId: string,
  exerciseId: string,
  newBest: number,
  now: Date,
  workoutId: string
) {
  const goal = await prisma.goal.findFirst({
    where: { userId, exerciseId, status: "ACTIVE" },
    include: { milestones: true },
  });
  if (!goal || newBest <= goal.currentBest) return;

  await prisma.goal.update({ where: { id: goal.id }, data: { currentBest: newBest } });

  for (const m of goal.milestones) {
    if (m.achievedAt === null && newBest >= m.value) {
      await prisma.goalMilestone.update({ where: { id: m.id }, data: { achievedAt: now } });
    }
  }

  if (newBest >= goal.targetValue) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: "COMPLETED", completedAt: now },
    });
    await prisma.achievement.create({
      data: {
        userId,
        type: "GOAL_COMPLETED",
        title: `${goal.title} goal reached: ${goal.targetValue} ${goal.unit}`,
        relatedGoalId: goal.id,
        relatedWorkoutId: workoutId,
        achievedAt: now,
      },
    });
  }
}

async function completeCardioWorkout(
  userId: string,
  workoutTypeId: string,
  workoutTypeName: string,
  payload: Extract<CompleteWorkoutPayload, { mode: "cardio" }>,
  now: Date
): Promise<WorkoutRecapResult> {
  const priorBestDistance = await prisma.workout.aggregate({
    where: { userId, workoutTypeId, cardioDistanceMiles: { not: null } },
    _max: { cardioDistanceMiles: true },
  });

  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: now,
      durationMinutes: payload.durationMinutes,
      cardioIndoorOutdoor: payload.indoorOutdoor,
      cardioTimeSeconds: payload.timeSeconds,
      cardioDistanceMiles: payload.distanceMiles,
    },
  });
  await createCompletedEvent(userId, workoutTypeId, workout.id, now);

  const prsAchieved: string[] = [];
  const bestSoFar = priorBestDistance._max.cardioDistanceMiles ?? 0;
  if (payload.distanceMiles != null && payload.distanceMiles > bestSoFar) {
    prsAchieved.push(`${workoutTypeName}: longest distance of ${payload.distanceMiles} mi`);
    await prisma.achievement.create({
      data: {
        userId,
        type: "PR",
        title: `${workoutTypeName} PR: ${payload.distanceMiles} mi`,
        relatedWorkoutId: workout.id,
        achievedAt: now,
      },
    });
  }

  const recap = await generateWorkoutRecap({
    workoutTypeName,
    prsAchieved,
    improvements: [],
    totalVolumeLb: null,
    goalContext: null,
  });
  await prisma.workout.update({ where: { id: workout.id }, data: { aiRecapText: recap } });

  return { recap, prsAchieved };
}

async function completeSimpleWorkout(
  userId: string,
  workoutTypeId: string,
  workoutTypeName: string,
  payload: Extract<CompleteWorkoutPayload, { mode: "simple" }>,
  now: Date
): Promise<WorkoutRecapResult> {
  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: now,
      durationMinutes: payload.durationMinutes,
      notes: payload.notes,
    },
  });
  await createCompletedEvent(userId, workoutTypeId, workout.id, now);

  const recap = await generateWorkoutRecap({
    workoutTypeName,
    prsAchieved: [],
    improvements: [],
    totalVolumeLb: null,
    goalContext: null,
  });
  await prisma.workout.update({ where: { id: workout.id }, data: { aiRecapText: recap } });

  return { recap, prsAchieved: [] };
}

export async function getWorkoutTypes() {
  const user = await getCurrentUser();
  const types = await prisma.workoutType.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return types.map((t) => ({
    ...t,
    weeklyGoalBucket: weeklyGoalBucketForWorkoutType(t.category as WorkoutCategory, t.colorKey),
  }));
}
