import type { ExperienceLevel, MovementCategory } from "@/lib/types/enums";

/**
 * A conservative first-session weight estimate, used only when an exercise
 * has no history yet (see progression.ts's `isFirstTime` branch). Compound
 * movement patterns scale off body weight (a standard strength-standards
 * approach); accessory/isolation patterns use a flat conservative base,
 * since those loads aren't well predicted by body weight.
 */
const BODYWEIGHT_RELATIVE_BASE: Partial<Record<MovementCategory, number>> = {
  squat_lunge: 0.4,
  hip_hinge: 0.5,
  hip_thrust_bridge: 0.5,
  horizontal_push: 0.3,
  vertical_push: 0.2,
  vertical_pull: 0.35,
  horizontal_pull: 0.3,
};

const FLAT_BASE_LB: Partial<Record<MovementCategory, number>> = {
  glute_abduction: 15,
  hamstring_isolation: 15,
  glute_isolation: 10,
  single_leg_stability: 10,
  adductors: 15,
  calves: 30,
  triceps_isolation: 15,
  chest_isolation: 12,
  shoulder_isolation: 8,
  biceps_isolation: 12,
  core: 10,
};

const EXPERIENCE_MULTIPLIER: Record<ExperienceLevel, number> = {
  new: 1.0,
  under_1_year: 1.3,
  one_to_three_years: 1.7,
  three_plus_years: 2.1,
};

const FALLBACK_BODYWEIGHT_LB = 150;

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Estimates a conservative starting weight for a movement category so a
 * brand-new exercise has a sensible first recommendation instead of a blank.
 * Falls back to an average body weight if the user skipped that step during
 * onboarding — the estimate is intentionally on the light side either way,
 * since the user can always edit it before their set.
 */
export function estimateStartingWeight(
  movementCategory: MovementCategory,
  experienceLevel: ExperienceLevel | null | undefined,
  bodyWeightLb: number | null | undefined
): number {
  const multiplier = EXPERIENCE_MULTIPLIER[experienceLevel ?? "new"];

  const bodyweightBase = BODYWEIGHT_RELATIVE_BASE[movementCategory];
  if (bodyweightBase !== undefined) {
    const weight = bodyWeightLb ?? FALLBACK_BODYWEIGHT_LB;
    return roundToNearest5(weight * bodyweightBase * multiplier);
  }

  const flatBase = FLAT_BASE_LB[movementCategory];
  if (flatBase !== undefined) {
    return roundToNearest5(flatBase * multiplier);
  }

  return roundToNearest5(20 * multiplier);
}
