import { describe, expect, it } from "vitest";
import { pickHomeInsightFact } from "./insights";

describe("pickHomeInsightFact", () => {
  it("prioritizes strength progress when available", () => {
    const result = pickHomeInsightFact({
      exerciseProgress: [
        { exerciseName: "Barbell Squat", earliestWeight: 95, currentBest: 145, sessionCount: 5 },
      ],
      currentStreak: 3,
      monthlyCompletedCount: 10,
      monthlyTarget: 18,
      totalWorkoutCount: 20,
    });
    expect(result?.insightType).toBe("strength_trend");
    expect(result?.fact).toContain("50 lb");
  });

  it("falls back to streak when no strength progress", () => {
    const result = pickHomeInsightFact({
      exerciseProgress: [],
      currentStreak: 4,
      monthlyCompletedCount: 2,
      monthlyTarget: 18,
      totalWorkoutCount: 5,
    });
    expect(result?.insightType).toBe("streak");
  });

  it("falls back to total workout count when nothing else applies", () => {
    const result = pickHomeInsightFact({
      exerciseProgress: [],
      currentStreak: 0,
      monthlyCompletedCount: 0,
      monthlyTarget: 18,
      totalWorkoutCount: 3,
    });
    expect(result?.insightType).toBe("total_count");
  });

  it("returns null with no data at all", () => {
    const result = pickHomeInsightFact({
      exerciseProgress: [],
      currentStreak: 0,
      monthlyCompletedCount: 0,
      monthlyTarget: 18,
      totalWorkoutCount: 0,
    });
    expect(result).toBeNull();
  });

  it("ignores single-session exercises to avoid trivial deltas", () => {
    const result = pickHomeInsightFact({
      exerciseProgress: [
        { exerciseName: "Barbell Squat", earliestWeight: 95, currentBest: 145, sessionCount: 1 },
      ],
      currentStreak: 0,
      monthlyCompletedCount: 0,
      monthlyTarget: 18,
      totalWorkoutCount: 1,
    });
    expect(result?.insightType).toBe("total_count");
  });
});
