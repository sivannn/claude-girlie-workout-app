import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMonthlyGoalStatus,
  getStreakStatus,
  getWeeklyGoalStatus,
  pickHomeInsightFact,
  recommendNextWorkout,
} from "@/lib/engine";
import type { EngineWorkoutSummary, EngineWorkoutType } from "@/lib/engine/types";
import { generateHomeInsight, generateRecommendationReason } from "@/lib/ai/alex";
import { weeklyGoalBucketForWorkoutType, type WeeklyGoalBucket } from "@/lib/data/workout-types";
import type { WorkoutCategory } from "@/lib/types/enums";

async function getRecentWorkoutSummaries(userId: string): Promise<EngineWorkoutSummary[]> {
  const workouts = await prisma.workout.findMany({
    where: { userId },
    include: { workoutType: true },
    orderBy: { date: "desc" },
  });
  return workouts.map((w) => ({
    id: w.id,
    date: w.date,
    workoutTypeId: w.workoutTypeId,
    category: w.workoutType.category as WorkoutCategory,
    colorKey: w.workoutType.colorKey,
    trainingCategory: null,
    durationMinutes: w.durationMinutes,
  }));
}

async function getExerciseProgress(userId: string) {
  const sets = await prisma.workoutSet.findMany({
    where: { actualWeight: { not: null }, workoutExercise: { workout: { userId } } },
    include: {
      workoutExercise: {
        select: { exerciseId: true, exercise: { select: { name: true } }, workout: { select: { date: true } } },
      },
    },
  });

  const byExercise = new Map<
    string,
    { name: string; earliest: { date: Date; weight: number }; best: number; sessionDates: Set<number> }
  >();

  for (const s of sets) {
    const exerciseId = s.workoutExercise.exerciseId;
    const name = s.workoutExercise.exercise.name;
    const date = s.workoutExercise.workout.date;
    const weight = s.actualWeight!;
    const existing = byExercise.get(exerciseId);
    if (!existing) {
      byExercise.set(exerciseId, {
        name,
        earliest: { date, weight },
        best: weight,
        sessionDates: new Set([date.getTime()]),
      });
    } else {
      if (date < existing.earliest.date) existing.earliest = { date, weight };
      if (weight > existing.best) existing.best = weight;
      existing.sessionDates.add(date.getTime());
    }
  }

  return Array.from(byExercise.values()).map((v) => ({
    exerciseName: v.name,
    earliestWeight: v.earliest.weight,
    currentBest: v.best,
    sessionCount: v.sessionDates.size,
  }));
}

export async function getHomeData() {
  const user = await getCurrentUser();
  const preferences = user.preferences;
  const weeklyTargets = {
    legDay: preferences?.weeklyLegDayTarget ?? 1,
    upperBody: preferences?.weeklyUpperBodyTarget ?? 1,
    cardio: preferences?.weeklyCardioTarget ?? 1,
    fun: preferences?.weeklyFunTarget ?? 1,
  };
  const monthlyTarget = preferences?.monthlyWorkoutTarget ?? 18;
  const now = new Date();

  const [workoutTypes, recentWorkouts, recentAchievements, exerciseProgress, draftEvent] = await Promise.all([
    prisma.workoutType.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getRecentWorkoutSummaries(user.id),
    prisma.achievement.findMany({
      where: { userId: user.id },
      orderBy: { achievedAt: "desc" },
      take: 3,
    }),
    getExerciseProgress(user.id),
    prisma.workoutEvent.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS" },
      include: { workoutType: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const draftWorkout = draftEvent
    ? { id: draftEvent.id, workoutTypeName: draftEvent.workoutType.name, colorKey: draftEvent.workoutType.colorKey }
    : null;

  const recommendation = recommendNextWorkout(
    workoutTypes as EngineWorkoutType[],
    recentWorkouts,
    weeklyTargets,
    now
  );
  const recommendationReason = recommendation
    ? await generateRecommendationReason(recommendation.workoutType.name, recommendation.reason)
    : null;
  const recommendedBucket = recommendation
    ? weeklyGoalBucketForWorkoutType(
        recommendation.workoutType.category as WorkoutCategory,
        recommendation.workoutType.colorKey
      )
    : null;

  // Weekly Goals "Start" links: leg_day maps to exactly one workout type, so
  // it can skip both picker steps; the other buckets span multiple types, so
  // they jump straight to step 2 (category already known).
  const legDayType = workoutTypes.find(
    (t) => weeklyGoalBucketForWorkoutType(t.category as WorkoutCategory, t.colorKey) === "leg_day"
  );
  const bucketStartHref: Record<WeeklyGoalBucket, string> = {
    leg_day: legDayType ? `/workout/new?type=${legDayType.id}` : "/workout/new?category=WEIGHTLIFTING",
    upper_body: "/workout/new?category=WEIGHTLIFTING",
    cardio: "/workout/new?category=CARDIO",
    fun: "/workout/new?category=FUN_ALL",
  };

  const weeklyStatus = getWeeklyGoalStatus(recentWorkouts, weeklyTargets, now);
  const monthlyStatus = getMonthlyGoalStatus(recentWorkouts, monthlyTarget, now);
  const streakStatus = getStreakStatus(recentWorkouts, weeklyTargets, now);

  const insightFact = pickHomeInsightFact({
    exerciseProgress,
    currentStreak: streakStatus.currentStreak,
    monthlyCompletedCount: monthlyStatus.completedCount,
    monthlyTarget: monthlyStatus.target,
    totalWorkoutCount: recentWorkouts.length,
  });
  const insightText = insightFact ? await generateHomeInsight(insightFact) : null;

  return {
    userName: user.name,
    recommendation,
    recommendationReason,
    recommendedBucket,
    weeklyStatus,
    monthlyStatus,
    streakStatus,
    recentAchievements,
    insightText,
    hasAnyWorkouts: recentWorkouts.length > 0,
    draftWorkout,
    bucketStartHref,
  };
}
