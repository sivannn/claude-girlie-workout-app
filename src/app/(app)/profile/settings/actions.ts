"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BLOCK_FOCUS_STYLES,
  DELOAD_PREFERENCES,
  EQUIPMENT_ACCESS_OPTIONS,
  EXPERIENCE_LEVELS,
  INJURY_AREAS,
  PRIMARY_GOALS,
  TRAINING_CATEGORIES,
  WORKOUT_PREFERENCES,
  type BlockFocusStyle,
  type DeloadPreference,
  type EquipmentAccess,
  type ExperienceLevel,
  type InjuryArea,
  type PrimaryGoal,
  type TrainingCategory,
  type WorkoutPreference,
} from "@/lib/types/enums";

export type SettingsInput = {
  primaryGoal: PrimaryGoal;
  musclePriorities: TrainingCategory[];
  workoutPreferences: WorkoutPreference[];
  equipmentAccess: EquipmentAccess;
  experienceLevel: ExperienceLevel;
  bodyWeightLb: number | null;
  monthlyWorkoutTarget: number;
  // Block Periodization answers.
  trainingDaysPerWeek: number;
  injuryAreas: InjuryArea[];
  injuryNote: string | null;
  blockDurationWeeks: number;
  blockCount: number;
  blockFocusStyle: BlockFocusStyle;
  deloadPreference: DeloadPreference;
};

/**
 * Answers that change what a generated training plan should look like.
 * Editing any of them will prompt the user to regenerate (Phase 4b) rather
 * than silently rewriting a plan they're partway through.
 */
export const PLAN_RELEVANT_FIELDS = [
  "primaryGoal",
  "trainingDaysPerWeek",
  "injuryAreas",
  "blockDurationWeeks",
  "blockCount",
  "blockFocusStyle",
  "deloadPreference",
] as const;

/**
 * Saves edited questionnaire answers from Profile > Account Settings.
 *
 * Deliberately NOT completeOnboarding: that action re-stamps
 * onboardingCompletedAt and unconditionally appends a BodyWeightLog row —
 * here onboarding state is untouched and a weight log is only written when
 * the value actually changed, so the Progress chart doesn't fill with
 * duplicate entries every time something unrelated is edited.
 */
export async function updateQuestionnaireAnswers(input: SettingsInput): Promise<void> {
  const user = await getCurrentUser();

  // SQLite has no CHECK constraints — the application boundary is the only
  // validation layer, so reject anything outside the known enum values and
  // clamp the numbers to their UI ranges before writing.
  if (!PRIMARY_GOALS.includes(input.primaryGoal)) throw new Error("Invalid primary goal.");
  if (!EQUIPMENT_ACCESS_OPTIONS.includes(input.equipmentAccess)) throw new Error("Invalid equipment option.");
  if (!EXPERIENCE_LEVELS.includes(input.experienceLevel)) throw new Error("Invalid experience level.");
  if (!input.musclePriorities.every((v) => TRAINING_CATEGORIES.includes(v))) {
    throw new Error("Invalid muscle priority.");
  }
  if (!input.workoutPreferences.every((v) => WORKOUT_PREFERENCES.includes(v))) {
    throw new Error("Invalid workout preference.");
  }
  if (!input.injuryAreas.every((v) => INJURY_AREAS.includes(v))) {
    throw new Error("Invalid injury area.");
  }
  if (!BLOCK_FOCUS_STYLES.includes(input.blockFocusStyle)) throw new Error("Invalid block focus style.");
  if (!DELOAD_PREFERENCES.includes(input.deloadPreference)) throw new Error("Invalid deload preference.");
  const trainingDaysPerWeek = Number.isFinite(input.trainingDaysPerWeek)
    ? Math.min(6, Math.max(2, Math.round(input.trainingDaysPerWeek)))
    : 3;
  const blockDurationWeeks = Number.isFinite(input.blockDurationWeeks)
    ? Math.min(8, Math.max(4, Math.round(input.blockDurationWeeks)))
    : 6;
  const blockCount = Number.isFinite(input.blockCount)
    ? Math.min(4, Math.max(2, Math.round(input.blockCount)))
    : 3;
  // Reject rather than clamp: a silently rewritten weight would append a
  // fabricated entry to the body-weight chart.
  const bodyWeightLb =
    input.bodyWeightLb != null && Number.isFinite(input.bodyWeightLb) ? input.bodyWeightLb : null;
  if (bodyWeightLb != null && (bodyWeightLb < 50 || bodyWeightLb > 1000)) {
    throw new Error("Body weight must be between 50 and 1000 lb.");
  }
  const monthlyWorkoutTarget = Number.isFinite(input.monthlyWorkoutTarget)
    ? Math.min(25, Math.max(8, Math.round(input.monthlyWorkoutTarget)))
    : 18;

  // Muscle priorities only apply to the build_muscle goal — clear them (and
  // the derived top priority) when the goal is anything else, mirroring the
  // wizard's conditional step. Dedup also bounds the stored JSON at the enum
  // sizes (no length cap needed).
  const musclePriorities =
    input.primaryGoal === "build_muscle" ? [...new Set(input.musclePriorities)] : [];
  const workoutPreferences = [...new Set(input.workoutPreferences)];

  await prisma.userPreferences.update({
    where: { userId: user.id },
    data: {
      primaryGoal: input.primaryGoal,
      musclePriorities: musclePriorities.length > 0 ? JSON.stringify(musclePriorities) : null,
      workoutPreferences:
        workoutPreferences.length > 0 ? JSON.stringify(workoutPreferences) : null,
      equipmentAccess: input.equipmentAccess,
      experienceLevel: input.experienceLevel,
      bodyWeightLb,
      monthlyWorkoutTarget,
      topPriorityCategory: musclePriorities[0] ?? null,
      trainingDaysPerWeek,
      injuryAreas: input.injuryAreas.length > 0 ? JSON.stringify([...new Set(input.injuryAreas)]) : null,
      injuryNote: input.injuryNote?.trim().slice(0, 280) || null,
      blockDurationWeeks,
      blockCount,
      blockFocusStyle: input.blockFocusStyle,
      deloadPreference: input.deloadPreference,
    },
  });

  // user was fetched before the update, so this is the pre-edit weight.
  const previousWeight = user.preferences?.bodyWeightLb ?? null;
  if (bodyWeightLb != null && bodyWeightLb !== previousWeight) {
    await prisma.bodyWeightLog.create({
      data: { userId: user.id, date: new Date(), weightLb: bodyWeightLb },
    });
  }

  revalidatePath("/", "layout");
}
