import { describe, expect, it } from "vitest";
import { forecastGoalCompletion, generateGoalMilestones, updateMilestoneAchievements } from "./goals";

describe("generateGoalMilestones", () => {
  it("generates increasing, round-number milestones ending at the target", () => {
    const milestones = generateGoalMilestones(95, 200);
    expect(milestones.length).toBeGreaterThanOrEqual(3);
    expect(milestones[milestones.length - 1].value).toBe(200);
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].value).toBeGreaterThan(milestones[i - 1].value);
    }
    for (const m of milestones) {
      expect(m.value % 5).toBe(0);
    }
  });

  it("handles a small range without producing degenerate output", () => {
    const milestones = generateGoalMilestones(45, 55);
    expect(milestones[milestones.length - 1].value).toBe(55);
    expect(milestones.every((m) => m.value > 45)).toBe(true);
  });
});

describe("updateMilestoneAchievements", () => {
  it("marks milestones achieved once the current best reaches them", () => {
    const milestones = [
      { value: 135, achievedAt: null as Date | null },
      { value: 155, achievedAt: null as Date | null },
      { value: 200, achievedAt: null as Date | null },
    ];
    const today = new Date("2026-07-14");
    const updated = updateMilestoneAchievements(milestones, 160, today);
    expect(updated[0].achievedAt).toEqual(today);
    expect(updated[1].achievedAt).toEqual(today);
    expect(updated[2].achievedAt).toBeNull();
  });
});

describe("forecastGoalCompletion", () => {
  it("returns null with fewer than 2 data points", () => {
    const result = forecastGoalCompletion(200, [{ date: new Date("2026-01-01"), value: 135 }], new Date());
    expect(result).toBeNull();
  });

  it("projects forward when progress trends toward the goal", () => {
    const history = [
      { date: new Date("2026-01-01"), value: 135 },
      { date: new Date("2026-04-01"), value: 145 },
    ];
    const result = forecastGoalCompletion(200, history, new Date("2026-04-01"));
    expect(result).not.toBeNull();
    expect(result!.estimatedWeeks).toBeGreaterThan(0);
  });

  it("returns null when progress is flat or regressing", () => {
    const history = [
      { date: new Date("2026-01-01"), value: 145 },
      { date: new Date("2026-04-01"), value: 140 },
    ];
    const result = forecastGoalCompletion(200, history, new Date("2026-04-01"));
    expect(result).toBeNull();
  });
});
