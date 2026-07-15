export type GeneratedExerciseView = {
  exerciseId: string;
  name: string;
  movementCategory: string;
  movementCategoryLabel: string;
  selectionReason: string;
  progressionReason: string;
  isDeload: boolean;
  isFirstTime: boolean;
  lastWorkoutSummary: string | null;
  longTermGoal: string | null;
  warmup: { weight: number | null; reps: number | null };
  workingSets: Array<{
    setNumber: number;
    recommendedWeight: number | null;
    recommendedRepsLow: number;
    recommendedRepsHigh: number;
  }>;
};

export type WeightliftingSessionData = {
  mode: "weightlifting";
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  brief: string;
  exercises: GeneratedExerciseView[];
  abExercise: GeneratedExerciseView | null;
};

export type CardioSessionData = {
  mode: "cardio";
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  reason: string;
  recommendedDistanceMiles: number | null;
  recommendedTimeSeconds: number | null;
};

export type SimpleSessionData = {
  mode: "simple";
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
};

export type GeneratedSessionData = WeightliftingSessionData | CardioSessionData | SimpleSessionData;

export type CompleteWeightliftingPayload = {
  mode: "weightlifting";
  workoutTypeId: string;
  durationMinutes: number;
  /** Exercises the coach recommended but the user removed before finishing — feeds the learning system. */
  removedExerciseIds: string[];
  exercises: Array<{
    exerciseId: string;
    movementCategory: string;
    reasonSelected: string;
    warmupWeight: number | null;
    warmupReps: number | null;
    sets: Array<{
      setNumber: number;
      recommendedWeight: number | null;
      actualWeight: number | null;
      recommendedRepsLow: number;
      recommendedRepsHigh: number;
      actualReps: number | null;
    }>;
  }>;
};

export type CompleteCardioPayload = {
  mode: "cardio";
  workoutTypeId: string;
  durationMinutes: number;
  indoorOutdoor: "indoor" | "outdoor";
  timeSeconds: number | null;
  distanceMiles: number | null;
};

export type CompleteSimplePayload = {
  mode: "simple";
  workoutTypeId: string;
  durationMinutes: number;
  notes: string | null;
};

export type CompleteWorkoutPayload =
  | CompleteWeightliftingPayload
  | CompleteCardioPayload
  | CompleteSimplePayload;

export type WorkoutRecapResult = {
  recap: string;
  prsAchieved: string[];
};
