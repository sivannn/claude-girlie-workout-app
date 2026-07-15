import { weeklyGoalBucketForWorkoutType, type WeeklyGoalBucket } from "@/lib/data/workout-types";
import type { TrainingCategory } from "@/lib/types/enums";
import { isLiftingTrainingCategory } from "./movementPatterns";
import type { EngineWorkoutSummary, EngineWorkoutType } from "./types";
import { getWeeklyGoalStatus, type WeeklyGoalTargets } from "./weeklyGoals";

export type NextWorkoutRecommendation = {
  workoutType: EngineWorkoutType;
  reason: string;
  estimatedDurationMinutes: number;
};

const RECOVERY_MIN_DAYS = 4;
const DEFAULT_DURATION_MINUTES: Record<string, number> = {
  WEIGHTLIFTING: 60,
  CARDIO: 35,
  FUN: 60,
  RECOVERY: 25,
};

function daysSince(date: Date, asOfDate: Date): number {
  return Math.floor((asOfDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function trainingCategoryOf(colorKey: string): TrainingCategory | null {
  if (colorKey === "glutes_legs" || colorKey === "chest_triceps" || colorKey === "back_biceps") {
    return colorKey;
  }
  return null;
}

function lastCompletedDateFor(
  workoutTypeId: string,
  recentWorkouts: EngineWorkoutSummary[]
): Date | null {
  const matches = recentWorkouts
    .filter((w) => w.workoutTypeId === workoutTypeId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return matches[0]?.date ?? null;
}

/**
 * Picks the AI Coach's recommended next workout, prioritizing weekly goal
 * balance and recovery per the Home Page / Calendar spec:
 *   1. Prefer the incomplete weekly-goal bucket that's gone longest overdue.
 *   2. Within a bucket with multiple workout types, pick the most overdue one.
 *   3. Avoid recommending the same weightlifting category trained <4 days ago.
 *   4. If all weekly buckets are already complete, fall back to whichever
 *      workout type overall has gone longest without being trained.
 */
export function recommendNextWorkout(
  workoutTypes: EngineWorkoutType[],
  recentWorkouts: EngineWorkoutSummary[],
  weeklyTargets: WeeklyGoalTargets,
  asOfDate: Date
): NextWorkoutRecommendation | null {
  if (workoutTypes.length === 0) return null;

  const mostRecentWorkout = recentWorkouts
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  const mostRecentTrainingCategory = mostRecentWorkout
    ? trainingCategoryOf(mostRecentWorkout.colorKey)
    : null;
  const daysSinceMostRecent = mostRecentWorkout ? daysSince(mostRecentWorkout.date, asOfDate) : Infinity;

  const isRecoveryBlocked = (type: EngineWorkoutType): boolean => {
    if (type.category !== "WEIGHTLIFTING") return false;
    const category = trainingCategoryOf(type.colorKey);
    return (
      !!category &&
      category === mostRecentTrainingCategory &&
      daysSinceMostRecent < RECOVERY_MIN_DAYS
    );
  };

  const withRecency = workoutTypes.map((type) => {
    const lastDate = lastCompletedDateFor(type.id, recentWorkouts);
    return {
      type,
      lastDate,
      daysSinceLast: lastDate ? daysSince(lastDate, asOfDate) : Infinity,
      bucket: weeklyGoalBucketForWorkoutType(type.category, type.colorKey),
    };
  });

  const weeklyStatus = getWeeklyGoalStatus(recentWorkouts, weeklyTargets, asOfDate);
  const incompleteBuckets = new Set<WeeklyGoalBucket>(
    (Object.keys(weeklyStatus) as WeeklyGoalBucket[]).filter((b) => !weeklyStatus[b].completed)
  );

  const rank = (candidates: typeof withRecency) =>
    candidates
      .filter((c) => !isRecoveryBlocked(c.type))
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast)[0];

  const incompleteCandidates = withRecency.filter((c) => c.bucket && incompleteBuckets.has(c.bucket));
  let winner = rank(incompleteCandidates);
  let reasonPrefix: "bucket" | "overall" = "bucket";

  if (!winner) {
    winner = rank(withRecency);
    reasonPrefix = "overall";
  }
  // If every candidate got recovery-blocked, fall back to the least-bad option.
  if (!winner) {
    winner = withRecency.sort((a, b) => b.daysSinceLast - a.daysSinceLast)[0];
  }
  if (!winner) return null;

  const reason =
    winner.lastDate === null
      ? `You haven't logged a ${winner.type.name} workout yet — a great one to establish this week.`
      : reasonPrefix === "bucket"
        ? `It's been ${winner.daysSinceLast} days since your last ${winner.type.name} workout, and you haven't completed your ${bucketLabel(winner.bucket)} goal this week yet.`
        : `It's been ${winner.daysSinceLast} days since your last ${winner.type.name} workout — the longest of any workout type — which keeps your training balanced.`;

  return {
    workoutType: winner.type,
    reason,
    estimatedDurationMinutes: typicalDurationFor(winner.type, recentWorkouts),
  };
}

const DURATION_HISTORY_SESSIONS = 5;

/**
 * "Preferred workout length" (adaptive memory): once there's enough recent
 * history for this exact workout type, use the user's own typical duration
 * instead of the generic category default.
 */
function typicalDurationFor(type: EngineWorkoutType, recentWorkouts: EngineWorkoutSummary[]): number {
  const durations = recentWorkouts
    .filter((w) => w.workoutTypeId === type.id && w.durationMinutes != null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, DURATION_HISTORY_SESSIONS)
    .map((w) => w.durationMinutes!);

  if (durations.length === 0) return DEFAULT_DURATION_MINUTES[type.category] ?? 45;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function bucketLabel(bucket: WeeklyGoalBucket | null): string {
  switch (bucket) {
    case "leg_day":
      return "Leg Day";
    case "upper_body":
      return "Upper Body";
    case "cardio":
      return "Cardio";
    case "fun":
      return "Fun Activity";
    default:
      return "weekly";
  }
}

export function trainingCategoryForWorkoutType(
  type: EngineWorkoutType
): Extract<TrainingCategory, "glutes_legs" | "chest_triceps" | "back_biceps"> | null {
  const category = trainingCategoryOf(type.colorKey);
  return category && isLiftingTrainingCategory(category) ? category : null;
}
