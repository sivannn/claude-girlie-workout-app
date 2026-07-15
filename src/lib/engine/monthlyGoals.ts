import { endOfMonth, startOfMonth } from "date-fns";
import type { EngineWorkoutSummary } from "./types";

export type MonthlyGoalStatus = {
  completedCount: number;
  target: number;
  progressPercent: number;
};

/** Monthly consistency goal (Home Page): total workouts this calendar month vs. target. */
export function getMonthlyGoalStatus(
  allWorkouts: EngineWorkoutSummary[],
  monthlyTarget: number,
  asOfDate: Date
): MonthlyGoalStatus {
  const monthStart = startOfMonth(asOfDate);
  const monthEnd = endOfMonth(asOfDate);

  const completedCount = allWorkouts.filter(
    (w) => w.date >= monthStart && w.date <= monthEnd
  ).length;

  return {
    completedCount,
    target: monthlyTarget,
    progressPercent: monthlyTarget > 0 ? Math.min(100, Math.round((completedCount / monthlyTarget) * 100)) : 0,
  };
}
