import { startOfWeek, subWeeks } from "date-fns";
import { describe, expect, it } from "vitest";
import { getStreakStatus } from "./streaks";
import type { EngineWorkoutSummary } from "./types";

const targets = { legDay: 1, upperBody: 1, cardio: 1, fun: 1 };

function workout(
  weeksAgo: number,
  dayOffset: number,
  colorKey: string,
  category: EngineWorkoutSummary["category"] = "WEIGHTLIFTING"
): EngineWorkoutSummary {
  const weekStart = subWeeks(startOfWeek(new Date("2026-07-14"), { weekStartsOn: 1 }), weeksAgo);
  const date = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return { id: `${weeksAgo}-${dayOffset}-${colorKey}`, date, workoutTypeId: colorKey, category, colorKey, trainingCategory: null };
}

function fullWeek(weeksAgo: number): EngineWorkoutSummary[] {
  return [
    workout(weeksAgo, 0, "glutes_legs"),
    workout(weeksAgo, 1, "chest_triceps"),
    workout(weeksAgo, 2, "running", "CARDIO"),
    workout(weeksAgo, 3, "yoga", "FUN"),
  ];
}

describe("getStreakStatus", () => {
  it("returns zero streaks with no workouts", () => {
    const result = getStreakStatus([], targets, new Date("2026-07-14"));
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("counts consecutive fully-complete past weeks without requiring the current week to be done", () => {
    const workouts = [...fullWeek(1), ...fullWeek(2), ...fullWeek(3)];
    const result = getStreakStatus(workouts, targets, new Date("2026-07-14"));
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("breaks the current streak at the first incomplete past week", () => {
    const workouts = [...fullWeek(1), ...fullWeek(3)]; // week 2 incomplete
    const result = getStreakStatus(workouts, targets, new Date("2026-07-14"));
    expect(result.currentStreak).toBe(1);
  });

  it("reports a longest streak longer than the current one", () => {
    const workouts = [...fullWeek(1), ...fullWeek(5), ...fullWeek(6), ...fullWeek(7)];
    const result = getStreakStatus(workouts, targets, new Date("2026-07-14"));
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(3);
  });
});
