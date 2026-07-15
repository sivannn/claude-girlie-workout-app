import { endOfWeek, startOfWeek } from "date-fns";
import { weeklyGoalBucketForWorkoutType, type WeeklyGoalBucket } from "@/lib/data/workout-types";
import type { EngineWorkoutSummary } from "./types";

export type WeeklyGoalTargets = {
  legDay: number;
  upperBody: number;
  cardio: number;
  fun: number;
};

export type WeeklyGoalBucketStatus = {
  bucket: WeeklyGoalBucket;
  target: number;
  completedCount: number;
  completed: boolean;
  /** Most recent qualifying workout date within the current week, if any. */
  completedDate: Date | null;
  /** Most recent qualifying workout ever, used for "last completed" when not done this week. */
  lastCompletedDate: Date | null;
};

export const WEEKLY_GOAL_BUCKETS: WeeklyGoalBucket[] = ["leg_day", "upper_body", "cardio", "fun"];

function targetFor(bucket: WeeklyGoalBucket, targets: WeeklyGoalTargets): number {
  switch (bucket) {
    case "leg_day":
      return targets.legDay;
    case "upper_body":
      return targets.upperBody;
    case "cardio":
      return targets.cardio;
    case "fun":
      return targets.fun;
  }
}

/** Core status computation for an arbitrary Monday-start week (used directly by streak scanning). */
export function getWeeklyGoalStatusForWeek(
  allWorkouts: EngineWorkoutSummary[],
  targets: WeeklyGoalTargets,
  weekStart: Date
): Record<WeeklyGoalBucket, WeeklyGoalBucketStatus> {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const result = {} as Record<WeeklyGoalBucket, WeeklyGoalBucketStatus>;

  for (const bucket of WEEKLY_GOAL_BUCKETS) {
    const matches = allWorkouts
      .filter((w) => weeklyGoalBucketForWorkoutType(w.category, w.colorKey) === bucket)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const thisWeekMatches = matches.filter((w) => w.date >= weekStart && w.date <= weekEnd);
    const target = targetFor(bucket, targets);

    result[bucket] = {
      bucket,
      target,
      completedCount: thisWeekMatches.length,
      completed: thisWeekMatches.length >= target,
      completedDate: thisWeekMatches[0]?.date ?? null,
      lastCompletedDate: matches[0]?.date ?? null,
    };
  }

  return result;
}

/** Weekly checklist status (Home Page + Calendar Weekly View) for the week containing asOfDate. */
export function getWeeklyGoalStatus(
  allWorkouts: EngineWorkoutSummary[],
  targets: WeeklyGoalTargets,
  asOfDate: Date
): Record<WeeklyGoalBucket, WeeklyGoalBucketStatus> {
  return getWeeklyGoalStatusForWeek(
    allWorkouts,
    targets,
    startOfWeek(asOfDate, { weekStartsOn: 1 })
  );
}

export function totalWeeklyGoalCount(targets: WeeklyGoalTargets): number {
  return targets.legDay + targets.upperBody + targets.cardio + targets.fun;
}

export function completedWeeklyGoalCount(
  status: Record<WeeklyGoalBucket, WeeklyGoalBucketStatus>
): number {
  return WEEKLY_GOAL_BUCKETS.filter((b) => status[b].completed).length;
}
