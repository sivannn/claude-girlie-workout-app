import type { EquipmentType, ExerciseKind, MovementCategory, TrainingCategory } from "@/lib/types/enums";

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
  /** Equipment required to perform this exercise - filters recommendations by the user's equipment access */
  equipment: EquipmentType;
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
  { name: "Barbell Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Goblet Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Walking Lunge", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Bulgarian Split Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Leg Press", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 10, equipment: "machine" },
  { name: "Bodyweight Squat", workoutCategory: "glutes_legs", movementCategory: "squat_lunge", kind: "STRENGTH", ...HIGH_REP, equipment: "bodyweight" },

  { name: "Romanian Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Conventional Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", repRangeLow: 5, repRangeHigh: 8, defaultIncrementLb: 10, equipment: "barbell" },
  { name: "Single-Leg Romanian Deadlift", workoutCategory: "glutes_legs", movementCategory: "hip_hinge", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Barbell Hip Thrust", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 10, equipment: "barbell" },
  { name: "Glute Bridge", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "bodyweight" },
  { name: "Single-Leg Hip Thrust", workoutCategory: "glutes_legs", movementCategory: "hip_thrust_bridge", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Cable Glute Kickback", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Standing Cable Abduction", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Hip Abduction Machine", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Banded Lateral Walk", workoutCategory: "glutes_legs", movementCategory: "glute_abduction", kind: "STRENGTH", ...HIGH_REP, equipment: "bands" },

  { name: "Lying Leg Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Seated Leg Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Nordic Curl", workoutCategory: "glutes_legs", movementCategory: "hamstring_isolation", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Frog Pump", workoutCategory: "glutes_legs", movementCategory: "glute_isolation", kind: "STRENGTH", ...HIGH_REP, equipment: "bodyweight" },
  { name: "Cable Pull-Through", workoutCategory: "glutes_legs", movementCategory: "glute_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },

  { name: "Step-Up", workoutCategory: "glutes_legs", movementCategory: "single_leg_stability", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Single-Leg Squat to Bench", workoutCategory: "glutes_legs", movementCategory: "single_leg_stability", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Cable Adduction", workoutCategory: "glutes_legs", movementCategory: "adductors", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Adductor Machine", workoutCategory: "glutes_legs", movementCategory: "adductors", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Side-Lying Leg Raise", workoutCategory: "glutes_legs", movementCategory: "adductors", kind: "STRENGTH", ...HIGH_REP, equipment: "bodyweight" },

  { name: "Standing Calf Raise", workoutCategory: "glutes_legs", movementCategory: "calves", kind: "STRENGTH", ...HIGH_REP, equipment: "bodyweight" },
  { name: "Seated Calf Raise", workoutCategory: "glutes_legs", movementCategory: "calves", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5, equipment: "machine" },

  // --- Chest, Shoulders & Triceps (Push) --------------------------------
  { name: "Barbell Bench Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Dumbbell Bench Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Machine Chest Press", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Push-Up", workoutCategory: "chest_triceps", movementCategory: "horizontal_push", kind: "STRENGTH", ...MACHINE_COMPOUND, equipment: "bodyweight" },

  { name: "Overhead Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Dumbbell Shoulder Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Machine Shoulder Press", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Pike Push-Up", workoutCategory: "chest_triceps", movementCategory: "vertical_push", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Triceps Pushdown", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Overhead Triceps Extension", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Skull Crusher", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Bench Dip", workoutCategory: "chest_triceps", movementCategory: "triceps_isolation", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Cable Fly", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Pec Deck", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Incline Dumbbell Fly", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Squeeze Push-Up", workoutCategory: "chest_triceps", movementCategory: "chest_isolation", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },

  { name: "Lateral Raise", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5, equipment: "dumbbell" },
  { name: "Cable Lateral Raise", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5, equipment: "cable" },
  { name: "Rear Delt Fly", workoutCategory: "chest_triceps", movementCategory: "shoulder_isolation", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 2.5, equipment: "dumbbell" },

  // --- Back & Biceps (Pull) ---------------------------------------------
  { name: "Lat Pulldown", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Pull-Up", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...COMPOUND, equipment: "bodyweight" },
  { name: "Assisted Pull-Up", workoutCategory: "back_biceps", movementCategory: "vertical_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "machine" },

  { name: "Seated Cable Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Barbell Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Dumbbell Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...COMPOUND, defaultIncrementLb: 5, equipment: "dumbbell" },
  { name: "Chest-Supported Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, defaultIncrementLb: 5, equipment: "machine" },
  { name: "Inverted Row", workoutCategory: "back_biceps", movementCategory: "horizontal_pull", kind: "STRENGTH", ...MACHINE_COMPOUND, equipment: "bodyweight" },

  { name: "Barbell Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "barbell" },
  { name: "Dumbbell Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 2.5, equipment: "dumbbell" },
  { name: "Hammer Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 2.5, equipment: "dumbbell" },
  { name: "Cable Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Band Curl", workoutCategory: "back_biceps", movementCategory: "biceps_isolation", kind: "STRENGTH", ...ISOLATION, equipment: "bands" },

  // --- Abs ----------------------------------------------------------------
  { name: "Cable Crunch", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5, equipment: "cable" },
  { name: "Hanging Leg Raise", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP, equipment: "bodyweight" },
  { name: "Plank", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", equipment: "bodyweight" },
  { name: "Ab Wheel Rollout", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...ISOLATION, equipment: "bodyweight" },
  { name: "Weighted Sit-Up", workoutCategory: "abs", movementCategory: "core", kind: "STRENGTH", ...HIGH_REP, defaultIncrementLb: 5, equipment: "dumbbell" },

  // --- Cardio ---------------------------------------------------------------
  { name: "Running", workoutCategory: "cardio", movementCategory: "other", kind: "CARDIO", equipment: "bodyweight" },
  { name: "Stairs", workoutCategory: "cardio", movementCategory: "other", kind: "CARDIO", equipment: "bodyweight" },
];
