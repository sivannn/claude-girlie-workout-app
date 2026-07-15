import "server-only";
import { subDays } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMonthlyGoalStatus,
  getStreakStatus,
  getWeeklyGoalStatus,
  pickHomeInsightFact,
} from "@/lib/engine";
import type { EngineWorkoutSummary } from "@/lib/engine/types";
import { generateHomeInsight } from "@/lib/ai/alex";
import type { WorkoutCategory } from "@/lib/types/enums";

const WINDOW_DAYS = 100;

export async function getProgressPageData() {
  const user = await getCurrentUser();
  const now = new Date();
  const windowStart = subDays(now, WINDOW_DAYS);

  const preferences = user.preferences;
  const weeklyTargets = {
    legDay: preferences?.weeklyLegDayTarget ?? 1,
    upperBody: preferences?.weeklyUpperBodyTarget ?? 1,
    cardio: preferences?.weeklyCardioTarget ?? 1,
    fun: preferences?.weeklyFunTarget ?? 1,
  };
  const monthlyTarget = preferences?.monthlyWorkoutTarget ?? 18;

  const [allWorkouts, activeGoals, bodyWeightLogs, achievements, recentSets] = await Promise.all([
    prisma.workout.findMany({ where: { userId: user.id }, include: { workoutType: true } }),
    prisma.goal.findMany({ where: { userId: user.id, status: "ACTIVE" } }),
    prisma.bodyWeightLog.findMany({
      where: { userId: user.id, date: { gte: windowStart } },
      orderBy: { date: "asc" },
    }),
    prisma.achievement.findMany({
      where: { userId: user.id },
      orderBy: { achievedAt: "desc" },
      take: 20,
    }),
    prisma.workoutSet.findMany({
      where: {
        actualWeight: { not: null },
        workoutExercise: { workout: { userId: user.id, date: { gte: windowStart } } },
      },
      include: {
        workoutExercise: {
          select: { exerciseId: true, exercise: { select: { name: true } }, workout: { select: { date: true } } },
        },
      },
    }),
  ]);

  const summaries: EngineWorkoutSummary[] = allWorkouts.map((w) => ({
    id: w.id,
    date: w.date,
    workoutTypeId: w.workoutTypeId,
    category: w.workoutType.category as WorkoutCategory,
    colorKey: w.workoutType.colorKey,
    trainingCategory: null,
  }));

  const streak = getStreakStatus(summaries, weeklyTargets, now);
  const monthly = getMonthlyGoalStatus(summaries, monthlyTarget, now);
  const weekly = getWeeklyGoalStatus(summaries, weeklyTargets, now);

  // Strength progress: line series per exercise over the last 100 days,
  // limited to the exercises trained most often in that window.
  const byExercise = new Map<
    string,
    { name: string; points: Array<{ date: string; weight: number }> }
  >();
  for (const s of recentSets) {
    const exerciseId = s.workoutExercise.exerciseId;
    const existing = byExercise.get(exerciseId) ?? {
      name: s.workoutExercise.exercise.name,
      points: [],
    };
    existing.points.push({
      date: s.workoutExercise.workout.date.toISOString().slice(0, 10),
      weight: s.actualWeight!,
    });
    byExercise.set(exerciseId, existing);
  }
  const strengthSeries = [...byExercise.values()]
    .filter((e) => e.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 4)
    .map((e) => ({
      name: e.name,
      // Collapse same-day sets to the day's best, sorted chronologically.
      points: Object.values(
        e.points.reduce<Record<string, { date: string; weight: number }>>((acc, p) => {
          if (!acc[p.date] || acc[p.date].weight < p.weight) acc[p.date] = p;
          return acc;
        }, {})
      ).sort((a, b) => a.date.localeCompare(b.date)),
    }));

  // Personal records: current best per exercise, all-time (not windowed).
  const allTimeSets = await prisma.workoutSet.findMany({
    where: { actualWeight: { not: null }, workoutExercise: { workout: { userId: user.id } } },
    include: { workoutExercise: { select: { exerciseId: true, exercise: { select: { name: true } } } } },
  });
  const personalRecords = new Map<string, { name: string; best: number }>();
  for (const s of allTimeSets) {
    const id = s.workoutExercise.exerciseId;
    const existing = personalRecords.get(id);
    if (!existing || existing.best < s.actualWeight!) {
      personalRecords.set(id, { name: s.workoutExercise.exercise.name, best: s.actualWeight! });
    }
  }
  const cardioBests = await prisma.workout.groupBy({
    by: ["workoutTypeId"],
    where: { userId: user.id, cardioDistanceMiles: { not: null } },
    _max: { cardioDistanceMiles: true },
  });
  const cardioTypes = await prisma.workoutType.findMany({
    where: { id: { in: cardioBests.map((c) => c.workoutTypeId) } },
  });

  // Workout balance over the window, by workout-type subtype.
  const windowWorkouts = allWorkouts.filter((w) => w.date >= windowStart);
  const balanceCounts = new Map<string, number>();
  for (const w of windowWorkouts) {
    const label = w.workoutType.colorKey;
    balanceCounts.set(label, (balanceCounts.get(label) ?? 0) + 1);
  }

  // Workout frequency: workouts per week over the window.
  const weekBuckets = new Map<string, number>();
  for (const w of windowWorkouts) {
    const weekKey = `${w.date.getFullYear()}-W${Math.ceil(
      (w.date.getTime() - windowStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )}`;
    weekBuckets.set(weekKey, (weekBuckets.get(weekKey) ?? 0) + 1);
  }

  const insightFact = pickHomeInsightFact({
    exerciseProgress: [...byExercise.values()]
      .filter((e) => e.points.length >= 2)
      .map((e) => ({
        exerciseName: e.name,
        earliestWeight: e.points[0].weight,
        currentBest: Math.max(...e.points.map((p) => p.weight)),
        sessionCount: e.points.length,
      })),
    currentStreak: streak.currentStreak,
    monthlyCompletedCount: monthly.completedCount,
    monthlyTarget: monthly.target,
    totalWorkoutCount: allWorkouts.length,
  });
  const overviewInsight = insightFact ? await generateHomeInsight(insightFact) : null;

  return {
    overviewInsight,
    activeGoals: activeGoals.map((g) => ({
      id: g.id,
      title: g.title,
      unit: g.unit,
      currentBest: g.currentBest,
      startingValue: g.startingValue,
      targetValue: g.targetValue,
    })),
    strengthSeries,
    consistency: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      monthlyCompleted: monthly.completedCount,
      monthlyTarget: monthly.target,
      weeklyCompleted: Object.values(weekly).filter((w) => w.completed).length,
      weeklyTarget: 4,
      weeklyFrequency: [...weekBuckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, count]) => ({ week, count })),
    },
    workoutBalance: [...balanceCounts.entries()].map(([colorKey, count]) => ({
      colorKey,
      count,
    })),
    bodyWeight: bodyWeightLogs.map((b) => ({ date: b.date.toISOString().slice(0, 10), weight: b.weightLb })),
    personalRecords: {
      strength: [...personalRecords.values()].sort((a, b) => b.best - a.best),
      cardio: cardioBests.map((c) => ({
        name: cardioTypes.find((t) => t.id === c.workoutTypeId)?.name ?? "Cardio",
        best: c._max.cardioDistanceMiles ?? 0,
      })),
    },
    milestones: achievements.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      achievedAt: a.achievedAt,
    })),
  };
}
