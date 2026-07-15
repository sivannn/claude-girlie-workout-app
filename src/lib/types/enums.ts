/**
 * SQLite has no native enum type, so these fields are plain strings in the
 * Prisma schema. These const unions are the single source of truth for valid
 * values at the application boundary (validated with zod where user input is
 * involved).
 */

export const WORKOUT_CATEGORIES = [
  "WEIGHTLIFTING",
  "CARDIO",
  "FUN",
  "RECOVERY",
] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export const EXERCISE_KINDS = ["STRENGTH", "CARDIO"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

// Workout-category groupings used for Goals, exercises, and the weekly checklist.
export const TRAINING_CATEGORIES = [
  "glutes_legs",
  "chest_triceps",
  "back_biceps",
  "abs",
  "cardio",
] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

// Movement pattern categories from the Workout Playbook.
export const MOVEMENT_CATEGORIES = [
  // Glutes & Legs
  "squat_lunge",
  "hip_hinge",
  "hip_thrust_bridge",
  "glute_abduction",
  "hamstring_isolation",
  "glute_isolation",
  "single_leg_stability",
  "adductors",
  "calves",
  // Push (Chest, Shoulders & Triceps)
  "horizontal_push",
  "vertical_push",
  "triceps_isolation",
  "chest_isolation",
  "shoulder_isolation",
  // Pull (Back & Biceps)
  "vertical_pull",
  "horizontal_pull",
  "biceps_isolation",
  // Abs / other
  "core",
  "other",
] as const;
export type MovementCategory = (typeof MOVEMENT_CATEGORIES)[number];

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const GOAL_STATUSES = ["ACTIVE", "COMPLETED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const EVENT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "MISSED",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_CREATED_BY = ["AI", "USER"] as const;
export type EventCreatedBy = (typeof EVENT_CREATED_BY)[number];

export const MEMORY_TYPES = ["PERMANENT", "ADAPTIVE", "SHORT_TERM"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const ACHIEVEMENT_TYPES = [
  "PR",
  "GOAL_COMPLETED",
  "STREAK",
  "MILESTONE_COUNT",
  "OTHER",
] as const;
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

export const COACH_INSIGHT_CATEGORIES = [
  "home_insight",
  "workout_brief",
  "workout_recap",
  "goal_forecast",
  "progress_overview",
  "goal_suggestion",
] as const;
export type CoachInsightCategory = (typeof COACH_INSIGHT_CATEGORIES)[number];

export const UNIT_SYSTEMS = ["imperial", "metric"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
