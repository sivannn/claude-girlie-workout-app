import type {
  EquipmentAccess,
  ExperienceLevel,
  PrimaryGoal,
  TrainingCategory,
  WorkoutPreference,
} from "@/lib/types/enums";

// Single source for the intro-questionnaire answer options, shared by the
// onboarding wizard and Profile > Account Settings so the two never drift.

export const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string; hint: string }> = [
  { value: "new", label: "New to lifting", hint: "Little to no strength training experience" },
  { value: "under_1_year", label: "Under 1 year", hint: "Getting the hang of the basics" },
  { value: "one_to_three_years", label: "1–3 years", hint: "Comfortable with most exercises" },
  { value: "three_plus_years", label: "3+ years", hint: "Experienced and consistent" },
];

export const PRIMARY_GOAL_OPTIONS: Array<{ value: PrimaryGoal; label: string; hint: string }> = [
  { value: "build_muscle", label: "Build muscle", hint: "Grow strength and size in specific areas" },
  { value: "lose_fat", label: "Lose fat", hint: "Lean out while staying strong" },
  { value: "build_strength", label: "Build strength", hint: "Get better at lifting heavy" },
  { value: "stay_active", label: "Stay active", hint: "Keep a consistent, healthy routine" },
  { value: "other", label: "Something else", hint: "I'll figure out the details as we go" },
];

export const MUSCLE_PRIORITY_OPTIONS: Array<{ value: TrainingCategory; label: string }> = [
  { value: "glutes_legs", label: "Legs & Glutes" },
  { value: "back_biceps", label: "Back & Biceps" },
  { value: "chest_triceps", label: "Chest & Triceps" },
  { value: "abs", label: "Abs" },
];

export const WORKOUT_PREFERENCE_OPTIONS: Array<{ value: WorkoutPreference; label: string }> = [
  { value: "weightlifting", label: "Weightlifting" },
  { value: "pilates", label: "Pilates" },
  { value: "yoga", label: "Yoga" },
  { value: "running", label: "Running" },
  { value: "hiking", label: "Hiking" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
  { value: "sports", label: "Sports (tennis, pickleball, etc.)" },
  { value: "other", label: "Something else" },
];

export const EQUIPMENT_OPTIONS: Array<{ value: EquipmentAccess; label: string; hint: string }> = [
  { value: "commercial_gym", label: "Commercial gym", hint: "Full range of machines, barbells, and cables" },
  { value: "home_gym", label: "Home gym", hint: "Barbell, rack, and dumbbells" },
  { value: "apartment_gym", label: "Apartment/building gym", hint: "A smaller selection of machines and dumbbells" },
  { value: "bodyweight_only", label: "Bodyweight only", hint: "No equipment, or just resistance bands" },
];
