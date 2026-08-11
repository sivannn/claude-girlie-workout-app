"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EQUIPMENT_ACCESS_OPTIONS,
  EXPERIENCE_LEVELS,
  PRIMARY_GOALS,
  TRAINING_CATEGORIES,
  WORKOUT_PREFERENCES,
  type EquipmentAccess,
  type ExperienceLevel,
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
};

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
