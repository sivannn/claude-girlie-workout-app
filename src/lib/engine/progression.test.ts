import { describe, expect, it } from "vitest";
import { decideProgression } from "./progression";
import type { EngineExercise, EngineExerciseSession } from "./types";

const squat: EngineExercise = {
  id: "squat",
  name: "Barbell Squat",
  workoutCategory: "glutes_legs",
  movementCategory: "squat_lunge",
  kind: "STRENGTH",
  repRangeLow: 6,
  repRangeHigh: 10,
  defaultIncrementLb: 5,
};

const asOf = new Date("2026-07-14");

function sessionAgo(daysAgo: number, sets: Array<{ weight: number; reps: number; recWeight?: number }>): EngineExerciseSession {
  const date = new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    date,
    sets: sets.map((s, i) => ({
      setNumber: i + 1,
      recommendedWeight: s.recWeight ?? s.weight,
      actualWeight: s.weight,
      recommendedRepsLow: 6,
      recommendedRepsHigh: 10,
      actualReps: s.reps,
    })),
  };
}

describe("decideProgression", () => {
  it("recommends a conservative starting point with no history", () => {
    const result = decideProgression(squat, [], asOf, 95);
    expect(result.isFirstTime).toBe(true);
    expect(result.recommendedWeight).toBe(95);
    expect(result.warmupWeight).toBe(50); // rounded to the nearest 5 from 95 * 0.5
  });

  it("returns null weight with no history and no starting hint", () => {
    const result = decideProgression(squat, [], asOf);
    expect(result.recommendedWeight).toBeNull();
  });

  it("increases weight when all working sets hit the top of the rep range", () => {
    const history = [sessionAgo(7, [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }])];
    const result = decideProgression(squat, history, asOf);
    expect(result.recommendedWeight).toBe(140); // +5 lb increment
    expect(result.isDeload).toBe(false);
  });

  it("holds weight when reps fall short of the top of the range", () => {
    const history = [sessionAgo(7, [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }])];
    const result = decideProgression(squat, history, asOf);
    expect(result.recommendedWeight).toBe(135);
  });

  it("holds weight and does not progress when reps miss the bottom of the range", () => {
    const history = [sessionAgo(7, [{ weight: 135, reps: 4 }, { weight: 135, reps: 4 }, { weight: 135, reps: 3 }])];
    const result = decideProgression(squat, history, asOf);
    expect(result.recommendedWeight).toBe(135);
    expect(result.reason).toMatch(/missed/i);
  });

  it("holds at the reduced weight after a voluntary weight cut, even if reps were strong", () => {
    const history = [
      sessionAgo(7, [
        { weight: 115, reps: 10, recWeight: 135 },
        { weight: 115, reps: 10, recWeight: 135 },
        { weight: 115, reps: 10, recWeight: 135 },
      ]),
    ];
    const result = decideProgression(squat, history, asOf);
    expect(result.recommendedWeight).toBe(115);
    expect(result.isDeload).toBe(false);
    expect(result.reason).toMatch(/pulled back/i);
  });

  it("recommends a deload after 3 consecutive stalled sessions", () => {
    const history = [
      sessionAgo(7, [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]),
      sessionAgo(14, [{ weight: 135, reps: 9 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]),
      sessionAgo(21, [{ weight: 135, reps: 8 }, { weight: 135, reps: 7 }, { weight: 135, reps: 7 }]),
    ];
    const result = decideProgression(squat, history, asOf);
    expect(result.isDeload).toBe(true);
    expect(result.recommendedWeight).toBeLessThan(135);
  });

  it("does not deload after only 2 stalled sessions", () => {
    const history = [
      sessionAgo(7, [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]),
      sessionAgo(14, [{ weight: 135, reps: 9 }, { weight: 135, reps: 8 }, { weight: 135, reps: 7 }]),
    ];
    const result = decideProgression(squat, history, asOf);
    expect(result.isDeload).toBe(false);
    expect(result.recommendedWeight).toBe(135);
  });

  it("eases back in after a long break instead of progressing", () => {
    const history = [
      sessionAgo(30, [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }]),
    ];
    const result = decideProgression(squat, history, asOf);
    expect(result.recommendedWeight).toBeLessThan(135);
    expect(result.reason).toMatch(/days/i);
  });

  it("falls back to default rep range and increment when the exercise has none configured", () => {
    const bodyweightMove: EngineExercise = {
      id: "pushup",
      name: "Push-Up",
      workoutCategory: "chest_triceps",
      movementCategory: "horizontal_push",
      kind: "STRENGTH",
      repRangeLow: null,
      repRangeHigh: null,
      defaultIncrementLb: null,
    };
    const result = decideProgression(bodyweightMove, [], asOf, 0);
    expect(result.recommendedRepsLow).toBe(8);
    expect(result.recommendedRepsHigh).toBe(12);
  });
});
