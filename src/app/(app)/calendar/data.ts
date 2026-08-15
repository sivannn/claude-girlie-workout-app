import "server-only";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { getActivePlan, materializePlanWeek } from "@/lib/data/plan-service";
import { prisma } from "@/lib/prisma";
import {
  getWeeklyGoalStatus,
  recommendNextWorkout,
  type NextWorkoutRecommendation,
} from "@/lib/engine";
import type { EngineWorkoutType } from "@/lib/engine/types";
import { getWorkoutSummaries } from "@/lib/data/workout-summaries";
import type { EventStatus, WorkoutCategory } from "@/lib/types/enums";
import { generateRecommendationReason } from "@/lib/ai/alex";
import { cachedInsight } from "@/lib/ai/insight-cache";

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
  /** Links a COMPLETED event to its journal entry for the detail view. */
  workoutId: string | null;
};

function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

function weeklyTargetsOf(user: CurrentUser) {
  return {
    legDay: user.preferences?.weeklyLegDayTarget ?? 1,
    upperBody: user.preferences?.weeklyUpperBodyTarget ?? 1,
    cardio: user.preferences?.weeklyCardioTarget ?? 1,
    fun: user.preferences?.weeklyFunTarget ?? 1,
  };
}

async function computeRecommendation(user: CurrentUser): Promise<NextWorkoutRecommendation | null> {
  // Preferences ride along on the request-cached user; the workout list is
  // shared with the weekly checklist via getWorkoutSummaries.
  const [workoutTypes, summaries] = await Promise.all([
    prisma.workoutType.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getWorkoutSummaries(user.id),
  ]);
  return recommendNextWorkout(
    workoutTypes as EngineWorkoutType[],
    summaries,
    weeklyTargetsOf(user),
    new Date()
  );
}

/**
 * Lightweight stand-in for a background scheduler (this app has no cron
 * infra): every calendar visit marks overdue planned events as missed, and
 * ensures today has a planned event reflecting the coach's current
 * recommendation if nothing is planned or completed yet.
 */
/**
 * Overdue planned workouts become missed. Runs whether or not a plan is
 * active — a plan owns *scheduling*, but nothing else marks the past.
 */
async function markOverdueAsMissed(userId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // One statement: updateMany on an empty match is already a no-op, so the
  // old find-then-update pair was a wasted round-trip.
  await prisma.workoutEvent.updateMany({
    where: { userId, status: "PLANNED", scheduledDate: { lt: startOfToday } },
    data: { status: "MISSED" },
  });
}

async function reconcileEvents(user: CurrentUser, recommendation: NextWorkoutRecommendation | null) {
  const userId = user.id;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!recommendation) return;

  // Once per day, not "whenever today looks empty" — otherwise removing or
  // rescheduling today's coach's pick would be silently undone on the next
  // page load. lastCoachPickDate comes off the request-cached user; a stale
  // read only matters across requests, and each request re-fetches the user.
  const lastPick = user.preferences?.lastCoachPickDate;
  if (lastPick && isSameDayUTC(lastPick, now)) return;

  const todaysEvents = await prisma.workoutEvent.findMany({
    where: { userId, scheduledDate: { gte: startOfToday } },
  });
  const hasTodayEvent = todaysEvents.some((e) => isSameDayUTC(e.scheduledDate, now));
  if (hasTodayEvent) {
    // Something is already on today's calendar — count the day as handled so
    // deleting that entry later doesn't summon a replacement.
    await prisma.userPreferences.updateMany({ where: { userId }, data: { lastCoachPickDate: now } });
    return;
  }

  await prisma.workoutEvent.create({
    data: {
      userId,
      workoutTypeId: recommendation.workoutType.id,
      scheduledDate: now,
      status: "PLANNED",
      createdBy: "AI",
    },
  });
  await prisma.userPreferences.updateMany({ where: { userId }, data: { lastCoachPickDate: now } });
}

export async function getCalendarMonthData(monthDate: Date) {
  const user = await getCurrentUser();

  // Stage 1 — independent reads (plus the overdue sweep, which no later step
  // reads until stage 2's barrier): run them concurrently, since each await
  // is a round-trip to the remote database in production.
  const [recommendation, activePlan] = await Promise.all([
    computeRecommendation(user),
    getActivePlan(user.id),
    markOverdueAsMissed(user.id),
  ]);

  // Stage 2 — scheduling writes, which must be visible to the events query
  // below. An active plan owns the schedule: its sessions go on the calendar
  // and the single-day "coach's pick" reconciler stands down so the two don't
  // fight. The insight lookup is independent of the writes, so it shares the
  // stage.
  const recommendationReasonPromise = recommendation
    ? cachedInsight({
        userId: user.id,
        category: "home_reason",
        facts: { kind: "reason", type: recommendation.workoutType.name, reason: recommendation.reason },
        generate: () =>
          generateRecommendationReason(recommendation.workoutType.name, recommendation.reason),
      })
    : Promise.resolve(null);
  const [recommendationReason] = await Promise.all([
    recommendationReasonPromise,
    activePlan ? materializePlanWeek(user.id, activePlan) : reconcileEvents(user, recommendation),
  ]);

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
    workoutId: e.workoutId,
  }));

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
    workoutId: e.workoutId,
  }));
}

export async function getWeeklyGoalChecklist(weekDate: Date) {
  const user = await getCurrentUser();
  // Same request-cached workout list the recommendation engine reads, and
  // targets straight off the user's already-loaded preferences.
  const summaries = await getWorkoutSummaries(user.id);
  return getWeeklyGoalStatus(summaries, weeklyTargetsOf(user), weekDate);
}

export type MonthlySummary = {
  totalCompleted: number;
  averagePerWeek: number;
  completionRate: number | null; // percent of resolved events completed; null when none resolved yet
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
  // null = no resolved events this month; the chart renders a dash instead of
  // the misleading "100%" an empty month used to show.
  const completionRate =
    completedEvents + missedEvents > 0
      ? Math.round((completedEvents / (completedEvents + missedEvents)) * 100)
      : null;

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
