import type { MovementCategory, TrainingCategory } from "@/lib/types/enums";

/**
 * Movement-pattern structure per the Workout Playbook. Each lifting category
 * has REQUIRED slots (one exercise per listed movement category — the
 * balanced-training guarantee) plus a ROTATING pool that fills the remaining
 * slots up to the target exercise count, for variety.
 *
 * "Use a stable foundation with rotating accessory exercises": required
 * slots prefer repeating the same exercise session-to-session (so weight
 * progression is trackable); rotating slots deliberately cycle for variety.
 */
export type MovementPatternSpec = {
  requiredSlots: MovementCategory[];
  rotatingPool: MovementCategory[];
  targetExerciseCount: number;
};

export const MOVEMENT_PATTERNS: Record<
  Extract<TrainingCategory, "glutes_legs" | "chest_triceps" | "back_biceps">,
  MovementPatternSpec
> = {
  glutes_legs: {
    requiredSlots: ["squat_lunge", "hip_hinge", "hip_thrust_bridge", "glute_abduction"],
    rotatingPool: [
      "hamstring_isolation",
      "glute_isolation",
      "single_leg_stability",
      "adductors",
      "calves",
    ],
    targetExerciseCount: 5,
  },
  chest_triceps: {
    requiredSlots: [
      "horizontal_push",
      "vertical_push",
      "triceps_isolation",
      "chest_isolation",
      "shoulder_isolation",
    ],
    rotatingPool: [],
    targetExerciseCount: 5,
  },
  back_biceps: {
    requiredSlots: ["vertical_pull", "horizontal_pull", "biceps_isolation"],
    // No dedicated 4th/5th movement category in the Playbook for pull day —
    // fill remaining slots by doubling up on the required categories.
    rotatingPool: ["horizontal_pull", "vertical_pull", "biceps_isolation"],
    targetExerciseCount: 5,
  },
};

// The ab routine appended to every weightlifting workout is generated
// separately from the 5-exercise structure above.
export const AB_ROUTINE_SPEC: MovementPatternSpec = {
  requiredSlots: ["core"],
  rotatingPool: [],
  targetExerciseCount: 1,
};

export function isLiftingTrainingCategory(
  category: TrainingCategory
): category is "glutes_legs" | "chest_triceps" | "back_biceps" {
  return category === "glutes_legs" || category === "chest_triceps" || category === "back_biceps";
}
