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
import type { ExperienceLevel, MovementCategory } from "@/lib/types/enums";
import { movementCategoryLabel } from "@/lib/data/movement-labels";

export type OnboardingInput = {
  experienceLevel: ExperienceLevel;
  bodyWeightLb: number | null;
  monthlyWorkoutTarget: number;
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
    const [liftingExercises, abExercises, preferences] = await Promise.all([
      prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: trainingCategory } }),
      prisma.exercise.findMany({ where: { userId: user.id, workoutCategory: "abs" } }),
      prisma.exercisePreference.findMany({ where: { userId: user.id } }),
    ]);

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
