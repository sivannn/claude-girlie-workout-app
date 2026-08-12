import type { MovementCategory, TrainingCategory } from "@/lib/types/enums";
import {
  selectAbExercise,
  selectExercisesForWorkout,
  type RecentSlotPick,
} from "./exerciseSelection";
import { decideProgression, rampWorkingSetWeights } from "./progression";
import type { EngineExercise, EngineExercisePreference, EngineExerciseSession } from "./types";

const DEFAULT_WORKING_SET_COUNT = 3;

export type GeneratedWorkoutExercise = {
  exercise: EngineExercise;
  movementCategory: MovementCategory;
  isRequiredSlot: boolean;
  selectionReason: string;
  progressionReason: string;
  isDeload: boolean;
  isFirstTime: boolean;
  warmup: { weight: number | null; reps: number | null };
  workingSets: Array<{ setNumber: number; weight: number | null; repsLow: number; repsHigh: number }>;
};

export type GeneratedWorkout = {
  trainingCategory: TrainingCategory;
  exercises: GeneratedWorkoutExercise[];
  abExercise: GeneratedWorkoutExercise | null;
};

/**
 * Overrides applied when a block-periodization plan is driving the session:
 * the block's rep range and set count replace the exercise defaults, and a
 * planned deload week scales the working weights down.
 */
export type PlanOverrides = {
  repRangeLow: number;
  repRangeHigh: number;
  workingSetCount: number;
  /** e.g. 0.85 during a planned deload week; 1 otherwise. */
  loadMultiplier: number;
};

function buildExercise(
  selection: { exercise: EngineExercise; movementCategory: MovementCategory; isRequiredSlot: boolean; reason: string },
  history: EngineExerciseSession[],
  startingWeightHint: number | null | undefined,
  asOfDate: Date,
  workingSetCount: number,
  planOverrides?: PlanOverrides
): GeneratedWorkoutExercise {
  const decision = decideProgression(selection.exercise, history, asOfDate, startingWeightHint);

  const setCount = planOverrides?.workingSetCount ?? workingSetCount;
  const multiplier = planOverrides?.loadMultiplier ?? 1;
  // The plan sets the target; progression still decides what that target is
  // from real logged history, so a deload scales the honest number rather
  // than inventing one.
  const targetWeight =
    decision.recommendedWeight != null
      ? roundToNearest5(decision.recommendedWeight * multiplier)
      : decision.recommendedWeight;

  const rampedWeights = rampWorkingSetWeights(
    targetWeight,
    selection.exercise.defaultIncrementLb,
    setCount
  );
  const workingSets = Array.from({ length: setCount }, (_, i) => ({
    setNumber: i + 1,
    weight: rampedWeights[i],
    repsLow: planOverrides?.repRangeLow ?? decision.recommendedRepsLow,
    repsHigh: planOverrides?.repRangeHigh ?? decision.recommendedRepsHigh,
  }));

  return {
    exercise: selection.exercise,
    movementCategory: selection.movementCategory,
    isRequiredSlot: selection.isRequiredSlot,
    selectionReason: selection.reason,
    progressionReason: decision.reason,
    isDeload: decision.isDeload,
    isFirstTime: decision.isFirstTime,
    warmup: {
      weight:
        decision.warmupWeight != null && multiplier !== 1
          ? roundToNearest5(decision.warmupWeight * multiplier)
          : decision.warmupWeight,
      reps: decision.warmupReps,
    },
    workingSets,
  };
}

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Builds a session from an explicit exercise list — the one a block
 * periodization plan prescribes for today — instead of letting the selection
 * engine choose. Weights still come from the user's logged history via
 * decideProgression; the plan contributes the exercises, the rep/set
 * prescription, and any deload scaling.
 */
export function generatePlannedWorkout(params: {
  trainingCategory: TrainingCategory;
  /** In the order the plan lists them (compounds first). */
  plannedExercises: Array<{ exercise: EngineExercise; movementCategory: MovementCategory }>;
  exerciseHistories: Map<string, EngineExerciseSession[]>;
  startingWeightHints?: Map<string, number>;
  asOfDate: Date;
  overrides: PlanOverrides;
}): GeneratedWorkout {
  const exercises = params.plannedExercises.map((planned) =>
    buildExercise(
      {
        exercise: planned.exercise,
        movementCategory: planned.movementCategory,
        isRequiredSlot: true,
        reason: "Part of today's plan session",
      },
      params.exerciseHistories.get(planned.exercise.id) ?? [],
      params.startingWeightHints?.get(planned.exercise.id),
      params.asOfDate,
      params.overrides.workingSetCount,
      params.overrides
    )
  );

  return { trainingCategory: params.trainingCategory, exercises, abExercise: null };
}

/**
 * Generates a complete weightlifting workout: exercise selection (movement
 * patterns + variety + learned preferences) combined with per-exercise
 * progression (double progression model). This is the single entry point
 * the Start Workout flow calls for weightlifting workout types.
 */
export function generateWeightliftingWorkout(params: {
  trainingCategory: Extract<TrainingCategory, "glutes_legs" | "chest_triceps" | "back_biceps">;
  availableExercises: EngineExercise[];
  abExercises: EngineExercise[];
  preferences: EngineExercisePreference[];
  recentPicks: RecentSlotPick[];
  recentAbPicks: RecentSlotPick[];
  /** Per-exercise session history, most-recent-first, keyed by exercise id. */
  exerciseHistories: Map<string, EngineExerciseSession[]>;
  /** Only consulted for exercises with no history yet. */
  startingWeightHints?: Map<string, number>;
  asOfDate: Date;
  workingSetCount?: number;
}): GeneratedWorkout {
  const workingSetCount = params.workingSetCount ?? DEFAULT_WORKING_SET_COUNT;

  const selections = selectExercisesForWorkout(
    params.trainingCategory,
    params.availableExercises,
    params.preferences,
    params.recentPicks
  );

  const exercises = selections.map((selection) =>
    buildExercise(
      selection,
      params.exerciseHistories.get(selection.exercise.id) ?? [],
      params.startingWeightHints?.get(selection.exercise.id),
      params.asOfDate,
      workingSetCount
    )
  );

  const abSelection = selectAbExercise(params.abExercises, params.preferences, params.recentAbPicks);
  const abExercise = abSelection
    ? buildExercise(
        abSelection,
        params.exerciseHistories.get(abSelection.exercise.id) ?? [],
        params.startingWeightHints?.get(abSelection.exercise.id),
        params.asOfDate,
        workingSetCount
      )
    : null;

  return { trainingCategory: params.trainingCategory, exercises, abExercise };
}
