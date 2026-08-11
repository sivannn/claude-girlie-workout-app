import type {
  BlockFocusStyle,
  DeloadPreference,
  EquipmentAccess,
  ExperienceLevel,
  InjuryArea,
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

// --- Block Periodization questions -----------------------------------------

export const TRAINING_DAYS_OPTIONS: Array<{ value: number; label: string; hint: string }> = [
  { value: 2, label: "2 days", hint: "Full-body sessions — the most that fits a busy week" },
  { value: 3, label: "3 days", hint: "Full-body, with a rest day between each" },
  { value: 4, label: "4 days", hint: "Upper/lower split — a strong middle ground" },
  { value: 5, label: "5 days", hint: "Push, pull, legs with room to repeat" },
  { value: 6, label: "6 days", hint: "Push, pull, legs twice through" },
];

export const INJURY_OPTIONS: Array<{ value: InjuryArea; label: string; hint: string }> = [
  { value: "knee", label: "Knees", hint: "Deep squatting and jumping get swapped out" },
  { value: "shoulder", label: "Shoulders", hint: "Overhead pressing and wide grips get swapped out" },
  { value: "lower_back", label: "Lower back", hint: "Loaded hinging and spinal compression get swapped out" },
  { value: "wrist", label: "Wrists", hint: "Front-rack and heavy pressing grips get swapped out" },
  { value: "hip", label: "Hips", hint: "Deep hip flexion and wide stances get swapped out" },
];

export const BLOCK_DURATION_OPTIONS: Array<{ value: number; label: string; hint: string }> = [
  { value: 4, label: "4 weeks", hint: "Change focus often — good if you get bored quickly" },
  { value: 6, label: "6 weeks", hint: "A balanced middle ground" },
  { value: 8, label: "8 weeks", hint: "Longer runway to see real progress on each focus" },
];

export const BLOCK_COUNT_OPTIONS: Array<{ value: number; label: string; hint: string }> = [
  { value: 2, label: "2 blocks", hint: "A short arc you can commit to" },
  { value: 3, label: "3 blocks", hint: "A full progression, start to finish" },
  { value: 4, label: "4 blocks", hint: "A long-term plan with plenty of variety" },
];

export const BLOCK_FOCUS_STYLE_OPTIONS: Array<{ value: BlockFocusStyle; label: string; hint: string }> = [
  {
    value: "balanced",
    label: "Rotate through focuses",
    hint: "Each block trains something different — muscle, then strength, then power",
  },
  {
    value: "specialized",
    label: "Stay focused on my goal",
    hint: "Most blocks push hard at your main goal, with lighter variation between",
  },
];

export const DELOAD_OPTIONS: Array<{ value: DeloadPreference; label: string; hint: string }> = [
  {
    value: "scheduled",
    label: "Plan a lighter week",
    hint: "The last week of each block eases off so you recover before the next push",
  },
  {
    value: "when_needed",
    label: "Only when I stall",
    hint: "Keep going until progress stalls, then back off automatically",
  },
  { value: "minimal", label: "Rarely", hint: "I'd rather keep the intensity up" },
];
