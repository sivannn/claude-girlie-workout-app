"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  estimateStartingWeight,
  generateWeightliftingWorkout,
  recommendNextWorkout,
  trainingCategoryForWorkoutType,
} from "@/lib/engine";
import type { EngineExercise, EngineExercisePreference, EngineWorkoutType } from "@/lib/engine/types";
import type {
  BlockFocusStyle,
  DeloadPreference,
  EquipmentAccess,
  ExperienceLevel,
  InjuryArea,
  MovementCategory,
  PrimaryGoal,
  TrainingCategory,
  WorkoutPreference,
} from "@/lib/types/enums";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import { filterExercisesByEquipment } from "@/lib/data/equipment";

export type OnboardingInput = {
  experienceLevel: ExperienceLevel;
  bodyWeightLb: number | null;
  monthlyWorkoutTarget: number;
  primaryGoal: PrimaryGoal;
  musclePriorities: TrainingCategory[];
  workoutPreferences: WorkoutPreference[];
  equipmentAccess: EquipmentAccess;
  // Block Periodization answers.
  trainingDaysPerWeek: number;
  injuryAreas: InjuryArea[];
  injuryNote: string | null;
  blockDurationWeeks: number;
  blockCount: number;
  blockFocusStyle: BlockFocusStyle;
  deloadPreference: DeloadPreference;
};

export type FirstWorkoutPreview = {
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  reason: string;
  estimatedDurationMinutes: number;
  exercises: Array<{ name: string; movementCategoryLabel: string }>;
};

export async function completeOnboarding(
  input: OnboardingInput
): Promise<{ preview: FirstWorkoutPreview | null }> {
  const user = await getCurrentUser();

  await prisma.userPreferences.update({
    where: { userId: user.id },
    data: {
      experienceLevel: input.experienceLevel,
      bodyWeightLb: input.bodyWeightLb,
      monthlyWorkoutTarget: input.monthlyWorkoutTarget,
      primaryGoal: input.primaryGoal,
      musclePriorities: input.musclePriorities.length > 0 ? JSON.stringify(input.musclePriorities) : null,
      workoutPreferences:
        input.workoutPreferences.length > 0 ? JSON.stringify(input.workoutPreferences) : null,
      equipmentAccess: input.equipmentAccess,
      topPriorityCategory: input.musclePriorities[0] ?? null,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      injuryAreas: input.injuryAreas.length > 0 ? JSON.stringify(input.injuryAreas) : null,
      injuryNote: input.injuryNote,
      blockDurationWeeks: input.blockDurationWeeks,
      blockCount: input.blockCount,
      blockFocusStyle: input.blockFocusStyle,
      deloadPreference: input.deloadPreference,
      onboardingCompletedAt: new Date(),
    },
  });

  if (input.bodyWeightLb) {
    await prisma.bodyWeightLog.create({
      data: { userId: user.id, date: new Date(), weightLb: input.bodyWeightLb },
    });
  }

  const workoutTypes = (await prisma.workoutType.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  })) as EngineWorkoutType[];

  const asOfDate = new Date();
  const recommendation = recommendNextWorkout(
    workoutTypes,
    [],
    {
      legDay: user.preferences?.weeklyLegDayTarget ?? 1,
      upperBody: user.preferences?.weeklyUpperBodyTarget ?? 1,
      cardio: user.preferences?.weeklyCardioTarget ?? 1,
      fun: user.preferences?.weeklyFunTarget ?? 1,
    },
    asOfDate
  );

  if (!recommendation) return { preview: null };

  const trainingCategory = trainingCategoryForWorkoutType(recommendation.workoutType);

  let exercises: FirstWorkoutPreview["exercises"] = [];

  if (trainingCategory) {
    const [liftingExercisesRaw, abExercisesRaw, preferences] = await Promise.all([
      prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: trainingCategory } }),
      prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: "abs" } }),
      prisma.exercisePreference.findMany({ where: { userId: user.id } }),
    ]);
    const liftingExercises = filterExercisesByEquipment(liftingExercisesRaw, input.equipmentAccess);
    const abExercises = filterExercisesByEquipment(abExercisesRaw, input.equipmentAccess);

    const engineExercises = [...liftingExercises, ...abExercises] as EngineExercise[];
    const startingWeightHints = new Map<string, number>();
    for (const ex of engineExercises) {
      startingWeightHints.set(
        ex.id,
        estimateStartingWeight(
          ex.movementCategory as MovementCategory,
          input.experienceLevel,
          input.bodyWeightLb
        )
      );
    }

    const generated = generateWeightliftingWorkout({
      trainingCategory,
      availableExercises: liftingExercises as EngineExercise[],
      abExercises: abExercises as EngineExercise[],
      preferences: preferences as EngineExercisePreference[],
      recentPicks: [],
      recentAbPicks: [],
      exerciseHistories: new Map(),
      startingWeightHints,
      asOfDate,
    });

    exercises = [
      ...generated.exercises.map((e) => ({
        name: e.exercise.name,
        movementCategoryLabel: movementCategoryLabel(e.movementCategory),
      })),
      ...(generated.abExercise
        ? [{ name: generated.abExercise.exercise.name, movementCategoryLabel: "Core" }]
        : []),
    ];
  }

  return {
    preview: {
      workoutTypeId: recommendation.workoutType.id,
      workoutTypeName: recommendation.workoutType.name,
      colorKey: recommendation.workoutType.colorKey,
      reason: recommendation.reason,
      estimatedDurationMinutes: recommendation.estimatedDurationMinutes,
      exercises,
    },
  };
}
