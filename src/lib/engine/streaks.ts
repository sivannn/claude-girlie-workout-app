import { startOfWeek, subWeeks } from "date-fns";
import { WEEKLY_GOAL_BUCKETS, getWeeklyGoalStatusForWeek, type WeeklyGoalTargets } from "./weeklyGoals";
import type { EngineWorkoutSummary } from "./types";

export type StreakStatus = {
  currentStreak: number;
  longestStreak: number;
};

function weekIsFullyComplete(
  allWorkouts: EngineWorkoutSummary[],
  targets: WeeklyGoalTargets,
  weekStart: Date
): boolean {
  const status = getWeeklyGoalStatusForWeek(allWorkouts, targets, weekStart);
  return WEEKLY_GOAL_BUCKETS.every((b) => status[b].completed);
}

/**
 * Workout Streak (Home Page): consecutive weeks where all four weekly goal
 * categories were completed. The current, still-in-progress week is only
 * counted toward the streak if it's already fully complete — an unfinished
 * current week never breaks the streak, since it hasn't ended yet.
 */
export function getStreakStatus(
  allWorkouts: EngineWorkoutSummary[],
  targets: WeeklyGoalTargets,
  asOfDate: Date
): StreakStatus {
  if (allWorkouts.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const currentWeekStart = startOfWeek(asOfDate, { weekStartsOn: 1 });
  const earliestDate = allWorkouts.reduce(
    (min, w) => (w.date < min ? w.date : min),
    allWorkouts[0].date
  );
  const earliestWeekStart = startOfWeek(earliestDate, { weekStartsOn: 1 });

  // Walk backwards week by week from the current week to the earliest workout,
  // recording completeness for every week in range.
  const weekCompleteness: boolean[] = []; // index 0 = current week, increasing = further in the past
  for (
    let weekStart = currentWeekStart;
    weekStart >= earliestWeekStart;
    weekStart = subWeeks(weekStart, 1)
  ) {
    weekCompleteness.push(weekIsFullyComplete(allWorkouts, targets, weekStart));
  }

  // Current streak: start at the current week if it's already complete,
  // otherwise start counting from last week (an in-progress week doesn't break it).
  let currentStreak = 0;
  let startIndex = 0;
  if (!weekCompleteness[0]) {
    startIndex = 1; // skip the unfinished current week without breaking the streak
  }
  for (let i = startIndex; i < weekCompleteness.length; i++) {
    if (weekCompleteness[i]) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // Longest streak: scan for the longest run of consecutive complete weeks,
  // excluding the current in-progress week from consideration unless it's complete.
  let longestStreak = 0;
  let run = 0;
  const scanFrom = weekCompleteness[0] ? 0 : 1;
  for (let i = scanFrom; i < weekCompleteness.length; i++) {
    if (weekCompleteness[i]) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}
