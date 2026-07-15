import type { MovementCategory, TrainingCategory } from "@/lib/types/enums";
import {
  selectAbExercise,
  selectExercisesForWorkout,
  type RecentSlotPick,
} from "./exerciseSelection";
import { decideProgression } from "./progression";
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

function buildExercise(
  selection: { exercise: EngineExercise; movementCategory: MovementCategory; isRequiredSlot: boolean; reason: string },
  history: EngineExerciseSession[],
  startingWeightHint: number | null | undefined,
  asOfDate: Date,
  workingSetCount: number
): GeneratedWorkoutExercise {
  const decision = decideProgression(selection.exercise, history, asOfDate, startingWeightHint);

  const workingSets = Array.from({ length: workingSetCount }, (_, i) => ({
    setNumber: i + 1,
    weight: decision.recommendedWeight,
    repsLow: decision.recommendedRepsLow,
    repsHigh: decision.recommendedRepsHigh,
  }));

  return {
    exercise: selection.exercise,
    movementCategory: selection.movementCategory,
    isRequiredSlot: selection.isRequiredSlot,
    selectionReason: selection.reason,
    progressionReason: decision.reason,
    isDeload: decision.isDeload,
    isFirstTime: decision.isFirstTime,
    warmup: { weight: decision.warmupWeight, reps: decision.warmupReps },
    workingSets,
  };
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
