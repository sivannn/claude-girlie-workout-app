import { describe, expect, it } from "vitest";
import { recommendNextWorkout } from "./recommendation";
import type { EngineWorkoutSummary, EngineWorkoutType } from "./types";

const targets = { legDay: 1, upperBody: 1, cardio: 1, fun: 1 };
const asOf = new Date("2026-07-14"); // Tuesday, week of Jul 13-19

const legDay: EngineWorkoutType = {
  id: "leg",
  name: "Leg Day",
  category: "WEIGHTLIFTING",
  colorKey: "glutes_legs",
  requiresRecommendation: true,
};
const chest: EngineWorkoutType = {
  id: "chest",
  name: "Chest & Triceps",
  category: "WEIGHTLIFTING",
  colorKey: "chest_triceps",
  requiresRecommendation: true,
};
const running: EngineWorkoutType = {
  id: "run",
  name: "Running",
  category: "CARDIO",
  colorKey: "running",
  requiresRecommendation: true,
};
const yoga: EngineWorkoutType = {
  id: "yoga",
  name: "Yoga",
  category: "FUN",
  colorKey: "yoga",
  requiresRecommendation: false,
};

function workout(
  id: string,
  daysAgo: number,
  type: EngineWorkoutType,
  durationMinutes?: number
): EngineWorkoutSummary {
  return {
    id,
    date: new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    workoutTypeId: type.id,
    category: type.category,
    colorKey: type.colorKey,
    trainingCategory: null,
    durationMinutes,
  };
}

describe("recommendNextWorkout", () => {
  it("returns null with no workout types", () => {
    expect(recommendNextWorkout([], [], targets, asOf)).toBeNull();
  });

  it("prioritizes an incomplete weekly bucket over a complete one", () => {
    const history = [
      workout("1", 1, chest), // upper_body done this week
      workout("2", 20, legDay), // leg_day not done this week, long overdue
      workout("3", 20, running),
      workout("4", 20, yoga),
    ];
    const result = recommendNextWorkout([legDay, chest, running, yoga], history, targets, asOf);
    expect(result?.workoutType.id).toBe("leg");
  });

  it("blocks recommending the same lifting category trained fewer than 4 days ago", () => {
    const history = [
      workout("1", 1, legDay), // trained yesterday
      workout("2", 30, chest),
    ];
    const result = recommendNextWorkout([legDay, chest], history, targets, asOf);
    expect(result?.workoutType.id).toBe("chest");
  });

  it("falls back to the overall longest-overdue type once all weekly buckets are complete", () => {
    const history = [
      workout("1", 1, legDay),
      workout("2", 2, chest),
      workout("3", 3, running),
      workout("4", 10, yoga), // longest overdue but bucket already complete this week
    ];
    const result = recommendNextWorkout([legDay, chest, running, yoga], history, targets, asOf);
    expect(result?.workoutType.id).toBe("yoga");
  });

  it("uses the user's own average duration once there's history for that type", () => {
    const history = [
      workout("1", 7, legDay, 70),
      workout("2", 14, legDay, 80),
      workout("3", 21, legDay, 90),
    ];
    const result = recommendNextWorkout([legDay], history, targets, asOf);
    expect(result?.estimatedDurationMinutes).toBe(80); // average of 70/80/90
  });

  it("falls back to the category default duration with no history for that type", () => {
    const result = recommendNextWorkout([legDay], [], targets, asOf);
    expect(result?.estimatedDurationMinutes).toBe(60);
  });
});
