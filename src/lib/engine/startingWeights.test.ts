import { describe, expect, it } from "vitest";
import { estimateStartingWeight } from "./startingWeights";

describe("estimateStartingWeight", () => {
  it("scales bodyweight-relative movements with the user's body weight", () => {
    const light = estimateStartingWeight("squat_lunge", "new", 120);
    const heavy = estimateStartingWeight("squat_lunge", "new", 200);
    expect(heavy).toBeGreaterThan(light);
  });

  it("scales up with experience level", () => {
    const beginner = estimateStartingWeight("horizontal_push", "new", 150);
    const experienced = estimateStartingWeight("horizontal_push", "three_plus_years", 150);
    expect(experienced).toBeGreaterThan(beginner);
  });

  it("falls back to an average body weight when none is provided", () => {
    const result = estimateStartingWeight("hip_hinge", "new", null);
    expect(result).toBeGreaterThan(0);
  });

  it("uses a flat conservative base for isolation movements regardless of body weight", () => {
    const light = estimateStartingWeight("biceps_isolation", "new", 120);
    const heavy = estimateStartingWeight("biceps_isolation", "new", 220);
    expect(light).toBe(heavy);
  });

  it("rounds to the nearest 5", () => {
    const result = estimateStartingWeight("calves", "under_1_year", 150);
    expect(result % 5).toBe(0);
  });
});
