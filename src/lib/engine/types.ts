import type {
  ExerciseKind,
  MovementCategory,
  Priority,
  TrainingCategory,
  WorkoutCategory,
} from "@/lib/types/enums";

/** Engine-facing view of an Exercise row — plain data, no Prisma dependency. */
export type EngineExercise = {
  id: string;
  name: string;
  workoutCategory: TrainingCategory;
  movementCategory: MovementCategory;
  kind: ExerciseKind;
  repRangeLow: number | null;
  repRangeHigh: number | null;
  defaultIncrementLb: number | null;
  // "Each side" labeling flags — display-only, carried through so the view
  // layer can label per-side weight/reps. Optional because engine-side test
  // fixtures and planned-exercise literals don't set them; they come from the
  // Exercise row at runtime. See src/lib/data/exercises.ts.
  perSideWeight?: boolean;
  perSideReps?: boolean;
};

export type EngineExercisePreference = {
  exerciseId: string;
  priority: Priority;
  timesRemoved: number;
  timesSelected: number;
  lastRecommendedAt: Date | null;
};

/** One set's actual-vs-recommended performance, used to drive progression decisions. */
export type EngineSetResult = {
  setNumber: number;
  recommendedWeight: number | null;
  actualWeight: number | null;
  recommendedRepsLow: number | null;
  recommendedRepsHigh: number | null;
  actualReps: number | null;
};

/** One past session's working-set results for a single exercise, most-recent-first ordering handled by the caller. */
export type EngineExerciseSession = {
  date: Date;
  sets: EngineSetResult[];
};

/** A single past workout, enough context for recommendation/history logic. */
export type EngineWorkoutSummary = {
  id: string;
  date: Date;
  workoutTypeId: string;
  category: WorkoutCategory;
  colorKey: string;
  trainingCategory: TrainingCategory | null; // null for FUN/RECOVERY types without a strength-training bucket
  durationMinutes?: number;
};

export type EngineWorkoutType = {
  id: string;
  name: string;
  category: WorkoutCategory;
  colorKey: string;
  requiresRecommendation: boolean;
};
