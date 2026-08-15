"use server";

import { getCurrentUser } from "@/lib/auth";
import { getTodaysPlanSession } from "@/lib/data/plan-service";
import { prisma } from "@/lib/prisma";
import {
  adjustWeight,
  decideCardioProgression,
  decideProgression,
  estimateCaloriesBurned,
  estimateStartingWeight,
  generateWeightliftingWorkout,
  generatePlannedWorkout,
  rampWorkingSetWeights,
  trainingCategoryForWorkoutType,
  validateAdjustments,
} from "@/lib/engine";
import type { AdjustmentContext } from "@/lib/engine/adjustments";
import type {
  EngineExercise,
  EngineExercisePreference,
  EngineExerciseSession,
  EngineWorkoutType,
} from "@/lib/engine/types";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import { recordCompletedEvent, resolveBackdate } from "@/lib/data/workout-logging";
import { parseLocalDateInput } from "@/lib/utils/date";
import { weeklyGoalBucketForWorkoutType } from "@/lib/data/workout-types";
import { filterExercisesByEquipment } from "@/lib/data/equipment";
import type { EquipmentAccess, ExperienceLevel, MovementCategory, WorkoutCategory } from "@/lib/types/enums";
import {
  generateExerciseInstructions,
  generateWorkoutBrief,
  generateWorkoutRecap,
  suggestWorkoutAdjustments,
} from "@/lib/ai/alex";
import type {
  CompleteWorkoutPayload,
  GeneratedExerciseView,
  GeneratedSessionData,
  WorkoutRecapResult,
} from "./types";
import type { DraftWeightliftingPayload } from "./sessionState";

const RECENT_SESSIONS_LIMIT = 5;

/**
 * MET-based estimate of what a session burned. Stored with its source so a
 * future wearable integration can replace it with a measured value.
 */
async function estimateBurnedFor(
  userId: string,
  workoutTypeId: string,
  durationMinutes: number
): Promise<{ caloriesBurned: number | null; caloriesBurnedSource: string | null }> {
  const [type, preferences] = await Promise.all([
    prisma.workoutType.findUnique({ where: { id: workoutTypeId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);
  if (!type) return { caloriesBurned: null, caloriesBurnedSource: null };
  const caloriesBurned = estimateCaloriesBurned({
    category: type.category as WorkoutCategory,
    colorKey: type.colorKey,
    durationMinutes,
    bodyWeightLb: preferences?.bodyWeightLb,
  });
  return {
    caloriesBurned,
    caloriesBurnedSource: caloriesBurned == null ? null : "estimated",
  };
}

async function getExerciseHistories(
  userId: string,
  exerciseIds: string[],
  /** When set (logging a past workout), only history up to that moment counts. */
  until?: Date
): Promise<Map<string, EngineExerciseSession[]>> {
  if (exerciseIds.length === 0) return new Map();

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: { exerciseId: { in: exerciseIds }, workout: { userId, ...(until ? { date: { lte: until } } : {}) } },
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

async function getRecentPicks(userId: string, workoutTypeId: string, limit = 4, until?: Date) {
  const recentWorkouts = await prisma.workout.findMany({
    where: { userId, workoutTypeId, ...(until ? { date: { lte: until } } : {}) },
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
    perSideWeight: generated.exercise.perSideWeight ?? false,
    perSideReps: generated.exercise.perSideReps ?? false,
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

export async function generateWorkoutForType(
  workoutTypeId: string,
  /** Set when logging a previous workout: recommendations are computed as of that day. */
  targetDate?: string | null
): Promise<GeneratedSessionData> {
  const user = await getCurrentUser();
  const workoutType = await prisma.workoutType.findFirstOrThrow({
    where: { id: workoutTypeId, userId: user.id },
  });

  // For a backdated session, progression/deload logic runs as of the target
  // day and only sees history up to it — a workout logged since then
  // shouldn't influence what was recommended "back then".
  const targetDay = targetDate ? parseLocalDateInput(targetDate) : null;
  const asOf = targetDay
    ? new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), 23, 59, 59, 999)
    : new Date();
  const until = targetDay ? asOf : undefined;

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
      where: { userId: user.id, workoutTypeId: workoutType.id, ...(until ? { date: { lte: until } } : {}) },
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
    getRecentPicks(user.id, workoutType.id, 4, until),
  ]);
  // Ab picks share the same recent workouts of this type.
  const recentAbPicks = recentPicks;

  const equipmentAccess = user.preferences?.equipmentAccess as EquipmentAccess | null | undefined;
  const liftingExercises = filterExercisesByEquipment(liftingExercisesRaw, equipmentAccess);
  const abExercises = filterExercisesByEquipment(abExercisesRaw, equipmentAccess);

  const allExerciseIds = [...liftingExercises, ...abExercises].map((e) => e.id);
  const [histories, goals] = await Promise.all([
    getExerciseHistories(user.id, allExerciseIds, until),
    getLongTermGoals(user.id, allExerciseIds),
  ]);

  // A weight the user told us they can already lift beats a bodyweight-derived
  // guess; a real logged session beats both.
  const knownStartingWeights = new Map(
    preferences
      .filter((p) => p.knownStartingWeightLb != null)
      .map((p) => [p.exerciseId, p.knownStartingWeightLb as number])
  );
  const startingWeightHints = new Map<string, number>();
  for (const ex of [...liftingExercises, ...abExercises]) {
    if (!histories.get(ex.id)?.length) {
      startingWeightHints.set(
        ex.id,
        knownStartingWeights.get(ex.id) ??
          estimateStartingWeight(
            ex.movementCategory as MovementCategory,
            user.preferences?.experienceLevel as ExperienceLevel | null | undefined,
            user.preferences?.bodyWeightLb
          )
      );
    }
  }

  // When a block-periodization plan has a session scheduled for today, the
  // plan supplies the exercises and the block's rep/set prescription (and
  // scales the load on a deload week). Weights still come from logged history
  // via decideProgression, so the plan never contradicts real lifting.
  const planSession = await getTodaysPlanSession(user.id, targetDay ?? new Date());
  const planExerciseRows = planSession
    ? await prisma.exercise.findMany({
        where: { id: { in: planSession.exerciseIds }, userId: user.id },
      })
    : [];
  const usePlan = planSession != null && planExerciseRows.length > 0;

  if (usePlan) {
    const orderedPlanExercises = planSession!.exerciseIds
      .map((id) => planExerciseRows.find((e) => e.id === id))
      .filter((e): e is (typeof planExerciseRows)[number] => e != null);
    const planHistories = await getExerciseHistories(
      user.id,
      orderedPlanExercises.map((e) => e.id),
      until
    );
    const planHints = new Map<string, number>();
    for (const ex of orderedPlanExercises) {
      if (!planHistories.get(ex.id)?.length) {
        planHints.set(
          ex.id,
          estimateStartingWeight(
            ex.movementCategory as MovementCategory,
            user.preferences?.experienceLevel as ExperienceLevel | null | undefined,
            user.preferences?.bodyWeightLb
          )
        );
      }
    }
    const plannedWorkout = generatePlannedWorkout({
      trainingCategory,
      plannedExercises: orderedPlanExercises.map((e) => ({
        exercise: e as EngineExercise,
        movementCategory: e.movementCategory as MovementCategory,
      })),
      exerciseHistories: planHistories,
      startingWeightHints: planHints,
      asOfDate: asOf,
      overrides: planSession!.overrides,
    });
    const planGoals = await getLongTermGoals(
      user.id,
      orderedPlanExercises.map((e) => e.id)
    );
    const planViews = plannedWorkout.exercises.map((e) =>
      toExerciseView(e, planHistories, planGoals)
    );
    const brief = await generateWorkoutBrief({
      workoutTypeName: `${planSession!.dayLabel} (${planSession!.blockFocusLabel} block)`,
      focus: planSession!.isDeloadWeek
        ? `a recovery week — lighter loads at ${planSession!.overrides.repRangeLow}-${planSession!.overrides.repRangeHigh} reps so you start the next block fresh`
        : `your ${planSession!.blockFocusLabel.toLowerCase()} block, week ${planSession!.weekInBlock} — ${planSession!.overrides.workingSetCount} sets of ${planSession!.overrides.repRangeLow}-${planSession!.overrides.repRangeHigh} reps`,
      progressed: planViews.filter((e) => !e.isFirstTime && /adds|hit the top/.test(e.progressionReason)).map((e) => e.name),
      held: planViews.filter((e) => !e.isFirstTime && /same weight/.test(e.progressionReason)).map((e) => e.name),
      substitutions: [],
    });
    return { mode: "weightlifting", ...base, brief, exercises: planViews, abExercise: null };
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
    asOfDate: asOf,
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

  const adjusted = await applyCoachAdjustments(user.id, exercises, histories);

  return { mode: "weightlifting", ...base, brief, exercises: adjusted, abExercise };
}

/**
 * Lets Alex nudge a session the engine already computed.
 *
 * Every proposal is validated against the user's own logged data and hard
 * bounds (src/lib/engine/adjustments.ts) before it changes anything, and any
 * change that survives is labelled on the exercise so the user can see why a
 * number differs from the plain progression. A failure here is a no-op.
 */
async function applyCoachAdjustments(
  userId: string,
  exercises: GeneratedExerciseView[],
  histories: Map<string, EngineExerciseSession[]>
): Promise<GeneratedExerciseView[]> {
  try {
    const preferences = await prisma.exercisePreference.findMany({
      where: { userId, exerciseId: { in: exercises.map((e) => e.exerciseId) } },
    });
    const removalsById = new Map(preferences.map((p) => [p.exerciseId, p.timesRemoved]));

    const contexts: AdjustmentContext[] = exercises.map((e) => ({
      exerciseId: e.exerciseId,
      isFirstTime: e.isFirstTime,
      isDeload: e.isDeload,
      sessionsAtTopOfRange: countSessionsAtTopOfRange(histories.get(e.exerciseId) ?? []),
      timesRemoved: removalsById.get(e.exerciseId) ?? 0,
    }));

    // Nothing in the session is eligible — skip the API call entirely.
    if (!contexts.some((c) => !c.isFirstTime && !c.isDeload)) return exercises;

    const proposals = await suggestWorkoutAdjustments(
      exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        recommendedWeight: e.workingSets.at(-1)?.recommendedWeight ?? null,
        repRange: `${e.workingSets[0]?.recommendedRepsLow ?? "?"}-${e.workingSets[0]?.recommendedRepsHigh ?? "?"}`,
        lastSessions: e.lastWorkoutSummary ?? "",
        sessionsAtTopOfRange: contexts[i].sessionsAtTopOfRange,
        timesRemoved: contexts[i].timesRemoved,
      }))
    );
    if (proposals.length === 0) return exercises;

    const applied = validateAdjustments(proposals, contexts);
    if (applied.length === 0) return exercises;

    const byId = new Map(applied.map((a) => [a.exerciseId, a]));
    return exercises.map((e) => {
      const adjustment = byId.get(e.exerciseId);
      // A swap is only a signal for future selection, not a live change.
      if (!adjustment || adjustment.kind === "swap_exercise") return e;
      return {
        ...e,
        coachAdjustment: adjustment.reason,
        workingSets: e.workingSets.map((s) => ({
          ...s,
          recommendedWeight: adjustWeight(s.recommendedWeight, adjustment.appliedMultiplier),
        })),
      };
    });
  } catch (error) {
    console.error("Coach adjustments skipped:", error);
    return exercises;
  }
}

/** Consecutive most-recent sessions where every logged set hit the top of the range. */
function countSessionsAtTopOfRange(sessions: EngineExerciseSession[]): number {
  let count = 0;
  for (const session of sessions) {
    const logged = session.sets.filter((s) => s.actualReps != null && s.recommendedRepsHigh != null);
    if (logged.length === 0) break;
    if (logged.every((s) => s.actualReps! >= s.recommendedRepsHigh!)) count++;
    else break;
  }
  return count;
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

/** Returns cached "how to perform" text for an exercise, generating + caching it on first request. */
export async function getExerciseInstructions(exerciseId: string): Promise<string> {
  const user = await getCurrentUser();
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { id: exerciseId, userId: user.id },
  });
  if (exercise.instructions) return exercise.instructions;

  const text = await generateExerciseInstructions({
    name: exercise.name,
    movementCategoryLabel: movementCategoryLabel(exercise.movementCategory as MovementCategory),
    equipment: exercise.equipment,
  });
  await prisma.exercise.update({ where: { id: exercise.id }, data: { instructions: text } });
  return text;
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
  const rampedWeights = rampWorkingSetWeights(decision.recommendedWeight, exercise.defaultIncrementLb, 3);

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    movementCategory: exercise.movementCategory,
    movementCategoryLabel: movementCategoryLabel(exercise.movementCategory as MovementCategory),
    perSideWeight: exercise.perSideWeight,
    perSideReps: exercise.perSideReps,
    selectionReason: "Added manually to today's workout.",
    progressionReason: decision.reason,
    isDeload: decision.isDeload,
    isFirstTime: decision.isFirstTime,
    lastWorkoutSummary: formatSessionSummary(history[0]),
    longTermGoal: goals.get(exerciseId) ?? null,
    warmup: { weight: decision.warmupWeight, reps: decision.warmupReps },
    workingSets: [1, 2, 3].map((setNumber, i) => ({
      setNumber,
      recommendedWeight: rampedWeights[i],
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
// Save & exit — resumable in-progress drafts (weightlifting only)
// ---------------------------------------------------------------------------

/** Creates or updates an IN_PROGRESS draft WorkoutEvent holding the full editable session state. */
export async function saveDraftWorkout(
  payload: DraftWeightliftingPayload,
  draftEventId: string | null
): Promise<{ draftEventId: string }> {
  const user = await getCurrentUser();
  const draftDataJson = JSON.stringify(payload);

  // The workout type comes from the client payload — confirm it's the user's.
  await prisma.workoutType.findFirstOrThrow({
    where: { id: payload.workoutTypeId, userId: user.id },
  });

  if (draftEventId) {
    // Constrained to IN_PROGRESS so a stale id can't overwrite a planned or
    // completed calendar event with draft state.
    await prisma.workoutEvent.findFirstOrThrow({
      where: { id: draftEventId, userId: user.id, status: "IN_PROGRESS" },
    });
    await prisma.workoutEvent.update({
      where: { id: draftEventId },
      data: { workoutTypeId: payload.workoutTypeId, draftDataJson },
    });
    return { draftEventId };
  }

  const created = await prisma.workoutEvent.create({
    data: {
      userId: user.id,
      workoutTypeId: payload.workoutTypeId,
      scheduledDate: new Date(),
      status: "IN_PROGRESS",
      createdBy: "USER",
      draftDataJson,
    },
  });
  return { draftEventId: created.id };
}

/** Reads back a draft's full session state for resuming the Start Workout flow. */
export async function loadDraftWorkout(
  draftEventId: string
): Promise<{ draftEventId: string; draft: DraftWeightliftingPayload } | null> {
  const user = await getCurrentUser();
  const event = await prisma.workoutEvent.findFirst({
    where: { id: draftEventId, userId: user.id, status: "IN_PROGRESS" },
  });
  if (!event?.draftDataJson) return null;
  return { draftEventId: event.id, draft: JSON.parse(event.draftDataJson) as DraftWeightliftingPayload };
}

/** Discards a draft — used when exiting a workout with nothing meaningful entered. */
export async function discardDraftWorkout(draftEventId: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.workoutEvent.deleteMany({ where: { id: draftEventId, userId: user.id } });
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
  // A backdated log gets the target day as its date (range-enforced here, on
  // the server); a live session gets the real current moment.
  const workoutDate = payload.targetDate
    ? resolveBackdate(payload.targetDate, payload.clientToday)
    : new Date();

  if (payload.mode === "weightlifting") {
    return completeWeightliftingWorkout(user.id, workoutType.id, workoutType.name, payload, workoutDate);
  }
  if (payload.mode === "cardio") {
    return completeCardioWorkout(user.id, workoutType.id, workoutType.name, payload, workoutDate);
  }
  return completeSimpleWorkout(user.id, workoutType.id, workoutType.name, payload, workoutDate);
}

async function completeWeightliftingWorkout(
  userId: string,
  workoutTypeId: string,
  workoutTypeName: string,
  payload: Extract<CompleteWorkoutPayload, { mode: "weightlifting" }>,
  workoutDate: Date
): Promise<WorkoutRecapResult> {
  const exerciseIds = payload.exercises.map((e) => e.exerciseId);
  const [priorBests, histories, exerciseRows, user] = await Promise.all([
    getPriorBestWeights(userId, exerciseIds),
    getExerciseHistories(userId, exerciseIds),
    prisma.exercise.findMany({ where: { id: { in: exerciseIds }, userId } }),
    getCurrentUser(),
  ]);
  // Every client-supplied exercise id must resolve to one of the user's own
  // exercises — anything else is a forged or stale reference.
  if (exerciseRows.length !== new Set(exerciseIds).size) {
    throw new Error("Workout references exercises that don't belong to this account.");
  }
  const exerciseNameById = new Map(exerciseRows.map((e) => [e.id, e.name]));

  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: workoutDate,
      durationMinutes: payload.durationMinutes,
      ...(await estimateBurnedFor(userId, workoutTypeId, payload.durationMinutes)),
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

  await recordCompletedEvent(prisma, {
    userId,
    workoutTypeId,
    workoutId: workout.id,
    date: workoutDate,
    draftEventId: payload.draftEventId,
  });

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
  // Client-supplied ids again — count only ones that are actually theirs.
  const ownedRemovedIds = payload.removedExerciseIds.length
    ? (
        await prisma.exercise.findMany({
          where: { id: { in: payload.removedExerciseIds }, userId },
          select: { id: true },
        })
      ).map((e) => e.id)
    : [];
  await Promise.all(
    ownedRemovedIds.map((exerciseId) =>
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
          achievedAt: workoutDate,
        },
      });
      await applyGoalProgress(userId, e.exerciseId, sessionBest, workoutDate, workout.id);
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
  workoutDate: Date
): Promise<WorkoutRecapResult> {
  const priorBestDistance = await prisma.workout.aggregate({
    where: { userId, workoutTypeId, cardioDistanceMiles: { not: null } },
    _max: { cardioDistanceMiles: true },
  });

  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: workoutDate,
      durationMinutes: payload.durationMinutes,
      ...(await estimateBurnedFor(userId, workoutTypeId, payload.durationMinutes)),
      cardioIndoorOutdoor: payload.indoorOutdoor,
      cardioTimeSeconds: payload.timeSeconds,
      cardioDistanceMiles: payload.distanceMiles,
    },
  });
  await recordCompletedEvent(prisma, { userId, workoutTypeId, workoutId: workout.id, date: workoutDate });

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
        achievedAt: workoutDate,
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
  workoutDate: Date
): Promise<WorkoutRecapResult> {
  const workout = await prisma.workout.create({
    data: {
      userId,
      workoutTypeId,
      date: workoutDate,
      durationMinutes: payload.durationMinutes,
      ...(await estimateBurnedFor(userId, workoutTypeId, payload.durationMinutes)),
      notes: payload.notes,
    },
  });
  await recordCompletedEvent(prisma, { userId, workoutTypeId, workoutId: workout.id, date: workoutDate });

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
