export type GeneratedExerciseView = {
  exerciseId: string;
  name: string;
  /**
   * Set when Alex proposed an adjustment to this exercise and the engine
   * validated it — shown to the user so a changed number is never silent.
   */
  coachAdjustment?: string | null;
  movementCategory: string;
  movementCategoryLabel: string;
  /** Weight is entered per-implement, so it's labeled "each side". */
  perSideWeight: boolean;
  /** Reps are counted per side (unilateral/alternating), so labeled "each side". */
  perSideReps: boolean;
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
  /** Set when finishing a resumed "save & exit" draft, so the draft event is converted rather than duplicated. */
  draftEventId?: string | null;
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

/** Present when logging a previous workout from the calendar instead of a live session. */
export type BackdateFields = {
  /** The day being logged for ("yyyy-MM-dd"); range-validated server-side. */
  targetDate?: string | null;
  /** The browser's local today, so a UTC server agrees with the picker's range. */
  clientToday?: string;
};

export type CompleteWorkoutPayload = (
  | CompleteWeightliftingPayload
  | CompleteCardioPayload
  | CompleteSimplePayload
) &
  BackdateFields;

export type WorkoutRecapResult = {
  recap: string;
  prsAchieved: string[];
};
