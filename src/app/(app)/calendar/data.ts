import "server-only";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getWeeklyGoalStatus,
  recommendNextWorkout,
  type NextWorkoutRecommendation,
} from "@/lib/engine";
import type { EngineWorkoutSummary, EngineWorkoutType } from "@/lib/engine/types";
import type { EventStatus, WorkoutCategory } from "@/lib/types/enums";
import { generateRecommendationReason } from "@/lib/ai/alex";

export type CalendarEvent = {
  id: string;
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  category: WorkoutCategory;
  status: EventStatus;
  date: Date;
  durationMinutes: number | null;
  summary: string | null;
};

function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

async function computeRecommendation(userId: string): Promise<NextWorkoutRecommendation | null> {
  const [workoutTypes, recentWorkouts, preferences] = await Promise.all([
    prisma.workoutType.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.workout.findMany({ where: { userId }, include: { workoutType: true } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);
  const summaries: EngineWorkoutSummary[] = recentWorkouts.map((w) => ({
    id: w.id,
    date: w.date,
    workoutTypeId: w.workoutTypeId,
    category: w.workoutType.category as WorkoutCategory,
    colorKey: w.workoutType.colorKey,
    trainingCategory: null,
  }));
  return recommendNextWorkout(
    workoutTypes as EngineWorkoutType[],
    summaries,
    {
      legDay: preferences?.weeklyLegDayTarget ?? 1,
      upperBody: preferences?.weeklyUpperBodyTarget ?? 1,
      cardio: preferences?.weeklyCardioTarget ?? 1,
      fun: preferences?.weeklyFunTarget ?? 1,
    },
    new Date()
  );
}

/**
 * Lightweight stand-in for a background scheduler (this app has no cron
 * infra): every calendar visit marks overdue planned events as missed, and
 * ensures today has a planned event reflecting the coach's current
 * recommendation if nothing is planned or completed yet.
 */
async function reconcileEvents(userId: string, recommendation: NextWorkoutRecommendation | null) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const overduePlanned = await prisma.workoutEvent.findMany({
    where: { userId, status: "PLANNED", scheduledDate: { lt: startOfToday } },
  });
  if (overduePlanned.length > 0) {
    await prisma.workoutEvent.updateMany({
      where: { id: { in: overduePlanned.map((e) => e.id) } },
      data: { status: "MISSED" },
    });
  }

  if (!recommendation) return;

  const todaysEvents = await prisma.workoutEvent.findMany({
    where: { userId, scheduledDate: { gte: startOfToday } },
  });
  const hasTodayEvent = todaysEvents.some((e) => isSameDayUTC(e.scheduledDate, now));
  if (hasTodayEvent) return;

  await prisma.workoutEvent.create({
    data: {
      userId,
      workoutTypeId: recommendation.workoutType.id,
      scheduledDate: now,
      status: "PLANNED",
      createdBy: "AI",
    },
  });
}

export async function getCalendarMonthData(monthDate: Date) {
  const user = await getCurrentUser();
  const recommendation = await computeRecommendation(user.id);
  await reconcileEvents(user.id, recommendation);

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });

  const events = await prisma.workoutEvent.findMany({
    where: { userId: user.id, scheduledDate: { gte: gridStart, lte: gridEnd } },
    include: { workoutType: true, workout: { select: { durationMinutes: true, aiRecapText: true } } },
    orderBy: { scheduledDate: "asc" },
  });

  const mapped: CalendarEvent[] = events.map((e) => ({
    id: e.id,
    workoutTypeId: e.workoutTypeId,
    workoutTypeName: e.workoutType.name,
    colorKey: e.workoutType.colorKey,
    category: e.workoutType.category as WorkoutCategory,
    status: e.status as EventStatus,
    date: e.scheduledDate,
    durationMinutes: e.workout?.durationMinutes ?? null,
    summary: e.workout?.aiRecapText ?? null,
  }));

  const recommendationReason = recommendation
    ? await generateRecommendationReason(recommendation.workoutType.name, recommendation.reason)
    : null;

  return {
    gridStart,
    gridEnd,
    events: mapped,
    recommendedWorkoutTypeId: recommendation?.workoutType.id ?? null,
    recommendationReason,
  };
}

/** Always the real current week — independent of whatever month is being browsed in the Monthly tab. */
export async function getCurrentWeekEvents(): Promise<CalendarEvent[]> {
  const user = await getCurrentUser();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const events = await prisma.workoutEvent.findMany({
    where: { userId: user.id, scheduledDate: { gte: weekStart, lte: weekEnd } },
    include: { workoutType: true, workout: { select: { durationMinutes: true, aiRecapText: true } } },
    orderBy: { scheduledDate: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    workoutTypeId: e.workoutTypeId,
    workoutTypeName: e.workoutType.name,
    colorKey: e.workoutType.colorKey,
    category: e.workoutType.category as WorkoutCategory,
    status: e.status as EventStatus,
    date: e.scheduledDate,
    durationMinutes: e.workout?.durationMinutes ?? null,
    summary: e.workout?.aiRecapText ?? null,
  }));
}

export async function getWeeklyGoalChecklist(weekDate: Date) {
  const user = await getCurrentUser();
  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    include: { workoutType: true },
  });
  const summaries: EngineWorkoutSummary[] = workouts.map((w) => ({
    id: w.id,
    date: w.date,
    workoutTypeId: w.workoutTypeId,
    category: w.workoutType.category as WorkoutCategory,
    colorKey: w.workoutType.colorKey,
    trainingCategory: null,
  }));
  const preferences = await prisma.userPreferences.findUnique({ where: { userId: user.id } });
  return getWeeklyGoalStatus(
    summaries,
    {
      legDay: preferences?.weeklyLegDayTarget ?? 1,
      upperBody: preferences?.weeklyUpperBodyTarget ?? 1,
      cardio: preferences?.weeklyCardioTarget ?? 1,
      fun: preferences?.weeklyFunTarget ?? 1,
    },
    weekDate
  );
}

export type MonthlySummary = {
  totalCompleted: number;
  averagePerWeek: number;
  completionRate: number; // percent of planned/missed events that were completed
  categoryBreakdown: Array<{ category: string; count: number }>;
  typeDistribution: Array<{ name: string; count: number }>;
};

export async function getMonthlySummary(monthDate: Date): Promise<MonthlySummary> {
  const user = await getCurrentUser();
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const [completedWorkouts, events] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      include: { workoutType: true },
    }),
    prisma.workoutEvent.findMany({
      where: {
        userId: user.id,
        scheduledDate: { gte: monthStart, lte: monthEnd },
        status: { in: ["COMPLETED", "MISSED"] },
      },
    }),
  ]);

  const completedEvents = events.filter((e) => e.status === "COMPLETED").length;
  const missedEvents = events.filter((e) => e.status === "MISSED").length;
  const completionRate =
    completedEvents + missedEvents > 0
      ? Math.round((completedEvents / (completedEvents + missedEvents)) * 100)
      : 100;

  const categoryCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const w of completedWorkouts) {
    categoryCounts.set(w.workoutType.category, (categoryCounts.get(w.workoutType.category) ?? 0) + 1);
    typeCounts.set(w.workoutType.name, (typeCounts.get(w.workoutType.name) ?? 0) + 1);
  }

  const weeksInMonth = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);

  return {
    totalCompleted: completedWorkouts.length,
    averagePerWeek: weeksInMonth > 0 ? Math.round((completedWorkouts.length / weeksInMonth) * 10) / 10 : 0,
    completionRate,
    categoryBreakdown: [...categoryCounts.entries()].map(([category, count]) => ({ category, count })),
    typeDistribution: [...typeCounts.entries()].map(([name, count]) => ({ name, count })),
  };
}
