"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forecastGoalCompletion, generateGoalMilestones } from "@/lib/engine";
import { generateGoalCompletionSuggestion, interpretGoalRequest } from "@/lib/ai/alex";
import { TRAINING_CATEGORIES, type TrainingCategory } from "@/lib/types/enums";
import { CATEGORY_DESCRIPTION, CATEGORY_NAME } from "@/lib/data/category-descriptions";

function roundToNiceNumber(value: number): number {
  return Math.round(value / 5) * 5;
}

async function getExerciseStartAndBest(exerciseId: string, userId: string) {
  const sets = await prisma.workoutSet.findMany({
    where: { actualWeight: { not: null }, workoutExercise: { exerciseId, workout: { userId } } },
    include: { workoutExercise: { select: { workout: { select: { date: true } } } } },
    orderBy: { workoutExercise: { workout: { date: "asc" } } },
  });
  if (sets.length === 0) return { startingValue: 0, currentBest: 0 };
  const startingValue = sets[0].actualWeight!;
  const currentBest = Math.max(...sets.map((s) => s.actualWeight!));
  return { startingValue, currentBest };
}

export async function getExercisesForCategory(category: TrainingCategory) {
  const user = await getCurrentUser();
  const exercises = await prisma.exercise.findMany({
    where: { userId: user.id, workoutCategory: category },
    orderBy: { name: "asc" },
  });
  return exercises.map((e) => ({ id: e.id, name: e.name, unit: e.kind === "CARDIO" ? "mi" : "lb" }));
}

export async function getGoalsPageData() {
  const user = await getCurrentUser();

  const [activeGoals, completedGoals] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { milestones: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  // Forecast each active goal from real weight-history-over-time.
  const forecasts = new Map<string, ReturnType<typeof forecastGoalCompletion>>();
  await Promise.all(
    activeGoals.map(async (goal) => {
      if (!goal.exerciseId) {
        forecasts.set(goal.id, null);
        return;
      }
      const sets = await prisma.workoutSet.findMany({
        where: {
          actualWeight: { not: null },
          workoutExercise: { exerciseId: goal.exerciseId, workout: { userId: user.id } },
        },
        include: { workoutExercise: { select: { workout: { select: { date: true } } } } },
      });
      const history = sets.map((s) => ({ date: s.workoutExercise.workout.date, value: s.actualWeight! }));
      forecasts.set(goal.id, forecastGoalCompletion(goal.targetValue, history, new Date()));
    })
  );

  const categories = TRAINING_CATEGORIES.map((category) => {
    const goalsInCategory = activeGoals.filter((g) => g.category === category);
    const progressPercents = goalsInCategory.map((g) => {
      const range = g.targetValue - g.startingValue;
      return range > 0 ? Math.min(100, Math.max(0, ((g.currentBest - g.startingValue) / range) * 100)) : 100;
    });
    const overallProgress = progressPercents.length
      ? Math.round(progressPercents.reduce((a, b) => a + b, 0) / progressPercents.length)
      : 0;

    let nextProjectedGoal: string | null = null;
    let bestWeeks = Infinity;
    for (const g of goalsInCategory) {
      const forecast = forecasts.get(g.id);
      if (forecast && forecast.estimatedWeeks < bestWeeks) {
        bestWeeks = forecast.estimatedWeeks;
        nextProjectedGoal = g.title;
      }
    }

    return {
      category,
      name: CATEGORY_NAME[category],
      description: CATEGORY_DESCRIPTION[category],
      overallProgress,
      activeGoalCount: goalsInCategory.length,
      nextProjectedGoal,
      goals: goalsInCategory.map((g) => ({
        id: g.id,
        title: g.title,
        unit: g.unit,
        startingValue: g.startingValue,
        currentBest: g.currentBest,
        targetValue: g.targetValue,
        priority: g.priority,
        milestones: g.milestones,
        forecast: forecasts.get(g.id) ?? null,
      })),
    };
  });

  // Proactively suggest a follow-up goal for completed goals with nothing active yet.
  const activeExerciseIds = new Set(activeGoals.map((g) => g.exerciseId).filter(Boolean));
  const dismissedKeys = new Set(
    (
      await prisma.coachMemory.findMany({
        where: { userId: user.id, key: { startsWith: "goal_suggestion_dismissed:" } },
        select: { key: true },
      })
    ).map((m) => m.key)
  );

  const suggestionCandidates = completedGoals.filter(
    (g) =>
      g.exerciseId &&
      !activeExerciseIds.has(g.exerciseId) &&
      !dismissedKeys.has(`goal_suggestion_dismissed:${g.id}`)
  );

  const suggestions = await Promise.all(
    suggestionCandidates.slice(0, 3).map(async (g) => {
      const suggestedNext = roundToNiceNumber(g.targetValue * 1.15);
      const message = await generateGoalCompletionSuggestion({
        exerciseName: g.title,
        achievedTarget: g.targetValue,
        unit: g.unit,
        suggestedNext,
      });
      return {
        completedGoalId: g.id,
        exerciseId: g.exerciseId!,
        category: g.category,
        title: g.title,
        unit: g.unit,
        suggestedNext,
        message,
      };
    })
  );

  return {
    categories,
    hallOfFame: completedGoals.map((g) => ({
      id: g.id,
      title: g.title,
      targetValue: g.targetValue,
      unit: g.unit,
      completedAt: g.completedAt,
    })),
    suggestions,
  };
}

export async function createGoal(input: {
  category: TrainingCategory;
  exerciseId: string;
  targetValue: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}) {
  const user = await getCurrentUser();
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { id: input.exerciseId, userId: user.id },
  });
  const { startingValue, currentBest } = await getExerciseStartAndBest(input.exerciseId, user.id);
  const unit = exercise.kind === "CARDIO" ? "mi" : "lb";

  const milestones = generateGoalMilestones(startingValue, input.targetValue);

  await prisma.goal.create({
    data: {
      userId: user.id,
      exerciseId: input.exerciseId,
      category: input.category,
      title: exercise.name,
      unit,
      startingValue,
      currentBest,
      targetValue: input.targetValue,
      priority: input.priority,
      milestones: { create: milestones },
    },
  });

  await prisma.exercisePreference.upsert({
    where: { userId_exerciseId: { userId: user.id, exerciseId: input.exerciseId } },
    update: { priority: input.priority },
    create: { userId: user.id, exerciseId: input.exerciseId, priority: input.priority },
  });
}

export async function suggestGoalFromRequest(userRequest: string): Promise<{
  exerciseId: string | null;
  exerciseName: string | null;
  category: TrainingCategory | null;
  explanation: string;
  suggestedTarget: number | null;
  unit: string | null;
}> {
  const user = await getCurrentUser();
  const exercises = await prisma.exercise.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const result = await interpretGoalRequest({
    userRequest,
    topPriorityCategory: user.preferences?.topPriorityCategory ?? null,
    candidateExercises: exercises.map((e) => ({ name: e.name, workoutCategory: e.workoutCategory })),
  });

  if (!result.exerciseName) {
    return {
      exerciseId: null,
      exerciseName: null,
      category: null,
      explanation: result.explanation,
      suggestedTarget: null,
      unit: null,
    };
  }

  const exercise = exercises.find((e) => e.name === result.exerciseName);
  if (!exercise) {
    return {
      exerciseId: null,
      exerciseName: null,
      category: null,
      explanation: result.explanation,
      suggestedTarget: null,
      unit: null,
    };
  }

  const { currentBest, startingValue } = await getExerciseStartAndBest(exercise.id, user.id);
  const base = currentBest || startingValue || (exercise.defaultIncrementLb ?? 20) * 4;
  const suggestedTarget = roundToNiceNumber(base * 1.2 || 25);

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    category: exercise.workoutCategory as TrainingCategory,
    explanation: result.explanation,
    suggestedTarget,
    unit: exercise.kind === "CARDIO" ? "mi" : "lb",
  };
}

export async function acceptGoalSuggestion(input: {
  completedGoalId: string;
  exerciseId: string;
  category: TrainingCategory;
  targetValue: number;
}) {
  const user = await getCurrentUser();
  const { startingValue, currentBest } = await getExerciseStartAndBest(input.exerciseId, user.id);
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { id: input.exerciseId, userId: user.id },
  });
  const unit = exercise.kind === "CARDIO" ? "mi" : "lb";

  await prisma.goal.create({
    data: {
      userId: user.id,
      exerciseId: input.exerciseId,
      category: input.category,
      title: exercise.name,
      unit,
      startingValue: currentBest || startingValue,
      currentBest: currentBest || startingValue,
      targetValue: input.targetValue,
      milestones: { create: generateGoalMilestones(currentBest || startingValue, input.targetValue) },
    },
  });
  await dismissGoalSuggestion(input.completedGoalId);
}

export async function dismissGoalSuggestion(completedGoalId: string) {
  const user = await getCurrentUser();
  // The memory key embeds a client-supplied goal id — only record dismissals
  // for goals that are actually the user's.
  const goal = await prisma.goal.findFirst({
    where: { id: completedGoalId, userId: user.id },
    select: { id: true },
  });
  if (!goal) return;
  await prisma.coachMemory.upsert({
    where: { userId_key: { userId: user.id, key: `goal_suggestion_dismissed:${completedGoalId}` } },
    update: {},
    create: {
      userId: user.id,
      key: `goal_suggestion_dismissed:${completedGoalId}`,
      type: "SHORT_TERM",
      valueJson: "true",
    },
  });
}
