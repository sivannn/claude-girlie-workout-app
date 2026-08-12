import { describe, expect, it } from "vitest";
import {
  MAX_ADJUSTMENTS_PER_SESSION,
  adjustWeight,
  validateAdjustment,
  validateAdjustments,
  type AdjustmentContext,
  type ProposedAdjustment,
} from "./adjustments";

const readyToProgress: AdjustmentContext = {
  exerciseId: "squat",
  isFirstTime: false,
  isDeload: false,
  sessionsAtTopOfRange: 3,
  timesRemoved: 0,
};

const increase: ProposedAdjustment = {
  exerciseId: "squat",
  kind: "increase_weight",
  percent: 5,
  reason: "topped the range three sessions running",
};

describe("adjustment validation", () => {
  it("allows a justified increase", () => {
    const result = validateAdjustment(increase, readyToProgress)!;
    expect(result).not.toBeNull();
    expect(result.appliedMultiplier).toBeCloseTo(1.05);
  });

  it("clamps an oversized increase to the cap rather than rejecting it", () => {
    const result = validateAdjustment({ ...increase, percent: 60 }, readyToProgress)!;
    // A model asking for +60% must not get it — but the underlying suggestion
    // was justified, so it lands at the ceiling.
    expect(result.appliedMultiplier).toBeCloseTo(1.1);
  });

  it("refuses to raise a weight the user hasn't been topping out", () => {
    expect(validateAdjustment(increase, { ...readyToProgress, sessionsAtTopOfRange: 1 })).toBeNull();
  });

  it("never touches an exercise with no history", () => {
    expect(validateAdjustment(increase, { ...readyToProgress, isFirstTime: true })).toBeNull();
  });

  it("never fights a deload in either direction", () => {
    const deloading = { ...readyToProgress, isDeload: true };
    expect(validateAdjustment(increase, deloading)).toBeNull();
    expect(
      validateAdjustment({ ...increase, kind: "decrease_weight", percent: 5 }, deloading)
    ).toBeNull();
  });

  it("allows a bounded back-off without requiring topped-out sessions", () => {
    const result = validateAdjustment(
      { exerciseId: "squat", kind: "decrease_weight", percent: 5, reason: "grinding lately" },
      { ...readyToProgress, sessionsAtTopOfRange: 0 }
    )!;
    expect(result.appliedMultiplier).toBeCloseTo(0.95);
  });

  it("clamps an oversized decrease too", () => {
    const result = validateAdjustment(
      { exerciseId: "squat", kind: "decrease_weight", percent: 80, reason: "back off" },
      { ...readyToProgress, sessionsAtTopOfRange: 0 }
    )!;
    expect(result.appliedMultiplier).toBeCloseTo(0.9);
  });

  it("ignores a zero or negative percentage", () => {
    expect(validateAdjustment({ ...increase, percent: 0 }, readyToProgress)).toBeNull();
    expect(validateAdjustment({ ...increase, percent: -20 }, readyToProgress)).toBeNull();
  });

  it("ignores a suggestion for an exercise that isn't in the session", () => {
    expect(validateAdjustment({ ...increase, exerciseId: "bench" }, readyToProgress)).toBeNull();
  });

  it("only swaps an exercise the user has actually kept removing", () => {
    const swap: ProposedAdjustment = {
      exerciseId: "squat",
      kind: "swap_exercise",
      reason: "removed repeatedly",
    };
    expect(validateAdjustment(swap, readyToProgress)).toBeNull();
    expect(validateAdjustment(swap, { ...readyToProgress, timesRemoved: 3 })).not.toBeNull();
  });
});

describe("batch validation", () => {
  const contexts: AdjustmentContext[] = [
    { ...readyToProgress, exerciseId: "a" },
    { ...readyToProgress, exerciseId: "b" },
    { ...readyToProgress, exerciseId: "c" },
  ];

  it("caps how much of one session a suggestion pass can touch", () => {
    const proposals: ProposedAdjustment[] = ["a", "b", "c"].map((id) => ({
      exerciseId: id,
      kind: "increase_weight",
      percent: 5,
      reason: "ready",
    }));
    expect(validateAdjustments(proposals, contexts)).toHaveLength(MAX_ADJUSTMENTS_PER_SESSION);
  });

  it("ignores duplicate suggestions for the same exercise", () => {
    const proposals: ProposedAdjustment[] = [
      { exerciseId: "a", kind: "increase_weight", percent: 5, reason: "ready" },
      { exerciseId: "a", kind: "increase_weight", percent: 10, reason: "again" },
    ];
    expect(validateAdjustments(proposals, contexts)).toHaveLength(1);
  });

  it("drops everything when nothing is justified", () => {
    const unjustified = contexts.map((c) => ({ ...c, sessionsAtTopOfRange: 0 }));
    const proposals: ProposedAdjustment[] = [
      { exerciseId: "a", kind: "increase_weight", percent: 5, reason: "hunch" },
    ];
    expect(validateAdjustments(proposals, unjustified)).toEqual([]);
  });
});

describe("applying an adjustment", () => {
  it("rounds to the nearest 5 lb like the rest of the app", () => {
    expect(adjustWeight(100, 1.05)).toBe(105);
    expect(adjustWeight(137, 1.05)).toBe(145);
    expect(adjustWeight(100, 0.95)).toBe(95);
  });

  it("leaves a null weight alone and never goes below the bar", () => {
    expect(adjustWeight(null, 1.05)).toBeNull();
    expect(adjustWeight(5, 0.5)).toBe(5);
  });
});
