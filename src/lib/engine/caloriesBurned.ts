import type { WorkoutCategory } from "@/lib/types/enums";

/**
 * Calories burned per workout, estimated deterministically.
 *
 * Uses the standard MET (metabolic equivalent) formula:
 *   kcal = MET x body weight (kg) x hours
 *
 * This is an estimate, not a measurement. A chest strap or watch would be more
 * accurate, but neither is reachable from a web app — see the Phase 0 answer on
 * wearables. `caloriesBurnedSource` on the Workout row records where a number
 * came from ("estimated" | "manual" | "wearable"), so if the app ever gains a
 * native wrapper with HealthKit access, measured values slot in without
 * changing anything downstream.
 */

/** MET values by workout subtype, keyed by the app's colorKey. */
const MET_BY_COLOR_KEY: Record<string, number> = {
  // Weightlifting — moderate-to-vigorous resistance training.
  glutes_legs: 5.0,
  chest_triceps: 4.5,
  back_biceps: 4.5,
  abs: 4.0,
  // Cardio
  running: 9.8,
  stairs: 8.8,
  incline_walking: 5.3,
  walking: 3.5,
  swimming: 7.0,
  cycling: 7.5,
  rowing: 7.0,
  elliptical: 5.0,
  // Classes / fun
  yoga: 3.0,
  pilates: 3.5,
  spin: 8.5,
  sports: 6.5,
  hiking: 6.0,
};

/** Fallbacks when a custom workout type has no recognized colorKey. */
const MET_BY_CATEGORY: Record<WorkoutCategory, number> = {
  WEIGHTLIFTING: 4.5,
  CARDIO: 7.0,
  FUN: 5.0,
  RECOVERY: 2.5,
};

const LB_PER_KG = 2.20462;
/** Used when the user never entered a body weight. */
const FALLBACK_BODY_WEIGHT_LB = 150;

export function metValueFor(category: WorkoutCategory, colorKey: string | null | undefined): number {
  if (colorKey && MET_BY_COLOR_KEY[colorKey] != null) return MET_BY_COLOR_KEY[colorKey];
  return MET_BY_CATEGORY[category] ?? 4.5;
}

/**
 * Estimated calories burned, rounded to the nearest 5 — the precision the
 * method actually justifies. Returns null for a zero-length workout.
 */
export function estimateCaloriesBurned(params: {
  category: WorkoutCategory;
  colorKey: string | null | undefined;
  durationMinutes: number;
  bodyWeightLb: number | null | undefined;
}): number | null {
  if (!params.durationMinutes || params.durationMinutes <= 0) return null;
  const met = metValueFor(params.category, params.colorKey);
  const weightKg = (params.bodyWeightLb ?? FALLBACK_BODY_WEIGHT_LB) / LB_PER_KG;
  const hours = params.durationMinutes / 60;
  const kcal = met * weightKg * hours;
  return Math.max(5, Math.round(kcal / 5) * 5);
}

/**
 * Calories remaining against a daily goal. Returns null when no goal is set,
 * so the UI can prompt rather than showing a meaningless number. `remaining`
 * can go negative — going over is real information, not an error.
 */
export function dailyCalorieStatus(params: {
  target: number | null | undefined;
  consumed: number;
  burned: number;
}): { target: number; consumed: number; burned: number; remaining: number; percentUsed: number } | null {
  if (!params.target || params.target <= 0) return null;
  // Exercise credits back against the day's budget, which is how most
  // calorie apps behave and what "calories remaining" implies to a user.
  const remaining = params.target - params.consumed + params.burned;
  const percentUsed = Math.round((params.consumed / params.target) * 100);
  return {
    target: params.target,
    consumed: params.consumed,
    burned: params.burned,
    remaining,
    percentUsed,
  };
}
