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
  // The recommendation reason lives apart from the fact-based home insight:
  // cachedInsight keeps one row per category, so sharing a category made the
  // two evict each other and re-call the API on every Home/Calendar load.
  "home_reason",
  "workout_brief",
  "workout_recap",
  "goal_forecast",
  "progress_overview",
  "goal_suggestion",
] as const;
export type CoachInsightCategory = (typeof COACH_INSIGHT_CATEGORIES)[number];

export const UNIT_SYSTEMS = ["imperial", "metric"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const EXPERIENCE_LEVELS = [
  "new",
  "under_1_year",
  "one_to_three_years",
  "three_plus_years",
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

// Collected during onboarding to personalize goal-setting.
export const PRIMARY_GOALS = [
  "build_muscle",
  "lose_fat",
  "build_strength",
  "stay_active",
  "other",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

// Common workout types a user might enjoy, collected during onboarding.
export const WORKOUT_PREFERENCES = [
  "weightlifting",
  "pilates",
  "yoga",
  "running",
  "hiking",
  "cycling",
  "swimming",
  "sports",
  "other",
] as const;
export type WorkoutPreference = (typeof WORKOUT_PREFERENCES)[number];

// Where the user typically trains - drives which exercises are recommended
// based on realistically available equipment.
export const EQUIPMENT_ACCESS_OPTIONS = [
  "commercial_gym",
  "home_gym",
  "apartment_gym",
  "bodyweight_only",
] as const;
export type EquipmentAccess = (typeof EQUIPMENT_ACCESS_OPTIONS)[number];

// What an exercise requires - filtered against a user's equipmentAccess so
// recommendations only include exercises they can actually perform.
export const EQUIPMENT_TYPES = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "bands",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Block periodization
// ---------------------------------------------------------------------------

// Anatomical muscle group, tagged alongside the existing workoutCategory
// (which is a *training-day* grouping, e.g. chest_triceps). Block
// periodization selects by muscle group and day, so both axes are needed:
// an Overhead Press is workoutCategory "chest_triceps" but muscleGroup
// "shoulders".
export const MUSCLE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const DIFFICULTY_TIERS = ["beginner", "intermediate", "advanced"] as const;
export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number];

export const EXERCISE_TYPES = ["compound", "isolation", "accessory"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

// Joints/areas a user can flag as injured or limited. A fixed checklist (not
// free text) because exercise filtering keys off these — the free-text note
// collected alongside is shown to the user, never parsed.
export const INJURY_AREAS = ["knee", "shoulder", "lower_back", "wrist", "hip"] as const;
export type InjuryArea = (typeof INJURY_AREAS)[number];

// The training emphasis of one block. Prescriptions (reps/sets/rest) come
// from src/lib/engine/blockPrescriptions.ts.
export const BLOCK_FOCUSES = ["hypertrophy", "strength", "power", "conditioning"] as const;
export type BlockFocus = (typeof BLOCK_FOCUSES)[number];

// How blocks are sequenced across a plan.
export const BLOCK_FOCUS_STYLES = ["balanced", "specialized"] as const;
export type BlockFocusStyle = (typeof BLOCK_FOCUS_STYLES)[number];

// How deloads are scheduled. "scheduled" plans a lighter final week into each
// block; "when_needed" leaves the engine's existing reactive stall-deload in
// charge; "minimal" keeps deloads rare.
export const DELOAD_PREFERENCES = ["scheduled", "when_needed", "minimal"] as const;
export type DeloadPreference = (typeof DELOAD_PREFERENCES)[number];

// The weekly training split a plan is built on.
export const WEEKLY_SPLITS = ["full_body", "upper_lower", "push_pull_legs"] as const;
export type WeeklySplit = (typeof WEEKLY_SPLITS)[number];

export const PLAN_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
