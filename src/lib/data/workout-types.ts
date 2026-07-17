import type { WorkoutCategory } from "@/lib/types/enums";

export type WorkoutTypeSeed = {
  name: string;
  category: WorkoutCategory;
  colorKey: string;
  /** false = Yoga/Pilates/Pickleball-style: just record duration + notes */
  requiresRecommendation: boolean;
};

// Initial workout types from the Start Workout Flow spec. Users can add more
// permanently via the "Other" option.
export const WORKOUT_TYPE_LIBRARY: WorkoutTypeSeed[] = [
  { name: "Leg Day", category: "WEIGHTLIFTING", colorKey: "glutes_legs", requiresRecommendation: true },
  { name: "Chest & Triceps", category: "WEIGHTLIFTING", colorKey: "chest_triceps", requiresRecommendation: true },
  { name: "Back & Biceps", category: "WEIGHTLIFTING", colorKey: "back_biceps", requiresRecommendation: true },
  { name: "Running", category: "CARDIO", colorKey: "running", requiresRecommendation: true },
  { name: "Stairs", category: "CARDIO", colorKey: "stairs", requiresRecommendation: true },
  { name: "Fast Walk", category: "CARDIO", colorKey: "incline_walking", requiresRecommendation: false },
  { name: "Incline Walk", category: "CARDIO", colorKey: "incline_walking", requiresRecommendation: false },
  { name: "Walk/Run", category: "CARDIO", colorKey: "running", requiresRecommendation: true },
  { name: "Swim", category: "CARDIO", colorKey: "swimming", requiresRecommendation: false },
  { name: "Yoga", category: "FUN", colorKey: "yoga", requiresRecommendation: false },
  { name: "Pilates", category: "FUN", colorKey: "pilates", requiresRecommendation: false },
  { name: "Spin Class", category: "FUN", colorKey: "cycling", requiresRecommendation: false },
  { name: "Pickleball", category: "FUN", colorKey: "pickleball", requiresRecommendation: false },
];

// Step-1 picker groups FUN-category types into "Class" vs "Fun Activity" tiles
// purely for display — both still share the FUN category and the single
// "fun" weekly-goal bucket, so no schema/goal changes are needed here.
export const CLASS_TYPE_NAMES = ["Yoga", "Pilates", "Spin Class"];

// Maps a WorkoutType.name to the "weekly goal" bucket it satisfies on the
// Home Page checklist (Leg Day / Upper Body / Cardio / Fun Activity).
export type WeeklyGoalBucket = "leg_day" | "upper_body" | "cardio" | "fun";

export function weeklyGoalBucketForWorkoutType(
  category: WorkoutCategory,
  colorKey: string
): WeeklyGoalBucket | null {
  if (colorKey === "glutes_legs") return "leg_day";
  if (category === "WEIGHTLIFTING") return "upper_body"; // chest_triceps, back_biceps, abs
  if (category === "CARDIO") return "cardio";
  if (category === "FUN") return "fun";
  return null; // RECOVERY workouts don't count toward the 4-workout weekly goal
}
