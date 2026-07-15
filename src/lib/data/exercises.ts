import type { ExerciseKind, MovementCategory, TrainingCategory } from "@/lib/types/enums";

export type ExerciseSeed = {
  name: string;
  workoutCategory: TrainingCategory;
  movementCategory: MovementCategory;
  kind: ExerciseKind;
  /** Working-set rep range per the Workout Playbook's double progression model */
  repRangeLow?: number;
  repRangeHigh?: number;
  /** Realistic per-session weight increment once an exercise is ready to progress */
  defaultIncrementLb?: number;
};

// Rep range bands from the Workout Playbook:
//   Compound lifts: 5-8 or 6-10 | Machine compounds: 8-12
//   Isolation: 10-15 | Lateral raises, calves, abs: 12-20
const COMPOUND = { repRangeLow: 6, repRangeHigh: 10 } as const;
const MACHINE_COMPOUND = { repRangeLow: 8, repRangeHigh: 12 } as const;
const ISOLATION = { repRangeLow: 10, repRangeHigh: 15 } as const;
const HIGH_REP = { repRangeLow: 12, repRangeHigh: 20 } as const;

export const EXERCISE_LIBRARY: ExerciseSeed[] = [
  // --- Glutes & Legs ---------------------------------------------------
  { name: "Barbell Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Goblet Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Walking Lunge", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Bulgarian Split Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Leg Press", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 10 },

  { name: "Romanian Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Conventional Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", repRangeLow: 5, repRangeHigh: 8, defaultIncrementLb: 10 },
  { name: "Single-Leg Romanian Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Barbell Hip Thrust", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 10 },
  { name: "Glute Bridge", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Single-Leg Hip Thrust", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Cable Glute Kickback", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Standing Cable Abduction", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Hip Abduction Machine", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Banded Lateral Walk", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...HIGH_REP },

  { name: "Lying Leg Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Seated Leg Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Nordic Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION },

  { name: "Frog Pump", workoutCategory: "glutes_legs", movementCategory: "glute_isolation", kind: "STRENGTH", ...HIGH_REP },
  { name: "Cable Pull-Through", workoutCategory: "glutes_legs", movementCategory: "glute_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Step-Up", workoutCategory: "glutes_legs", movementCategory: "single_leg_stability", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Single-Leg Squat to Bench", workoutCategory: "glutes_legs", movementCategory: "single_leg_stability", kind: "STRENGTH", ...ISOLATION },

  { name: "Cable Adduction", workoutCategory: "glutes_legs", movementCategory: "adductors", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Adductor Machine", workoutCategory: "glutes_legs", movementCategory: "adductors", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Standing Calf Raise", workoutCategory: "glutes_legs", movementCategory: "calves", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 10 },
  { name: "Seated Calf Raise", workoutCategory: "glutes_legs", movementCategory: "calves", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5 },

  // --- Chest, Shoulders & Triceps (Push) --------------------------------
  { name: "Barbell Bench Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Dumbbell Bench Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Machine Chest Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Push-Up", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...MACHINE_COMPOUND },

  { name: "Overhead Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Dumbbell Shoulder Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Machine Shoulder Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },

  { name: "Triceps Pushdown", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Overhead Triceps Extension", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Skull Crusher", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Cable Fly", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Pec Deck", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Incline Dumbbell Fly", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  { name: "Lateral Raise", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5 },
  { name: "Cable Lateral Raise", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5 },
  { name: "Rear Delt Fly", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5 },

  // --- Back & Biceps (Pull) ---------------------------------------------
  { name: "Lat Pulldown", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Pull-Up", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...COMPOUND },
  { name: "Assisted Pull-Up", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },

  { name: "Seated Cable Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },
  { name: "Barbell Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Dumbbell Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5 },
  { name: "Chest-Supported Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5 },

  { name: "Barbell Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },
  { name: "Dumbbell Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 2.5 },
  { name: "Hammer Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 2.5 },
  { name: "Cable Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5 },

  // --- Abs ----------------------------------------------------------------
  { name: "Cable Crunch", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5 },
  { name: "Hanging Leg Raise", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP },
  { name: "Plank", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH" },
  { name: "Ab Wheel Rollout", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...ISOLATION },
  { name: "Weighted Sit-Up", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5 },

  // --- Cardio ---------------------------------------------------------------
  { name: "Running", workoutCategory: "cardio", movementCategory: "other", kind: "CARDIO" },
  { name: "Stairs", workoutCategory: "cardio", movementCategory: "other", kind: "CARDIO" },
];
