import { describe, expect, it } from "vitest";
import { dailyCalorieStatus, estimateCaloriesBurned, metValueFor } from "./caloriesBurned";

describe("calories burned estimation", () => {
  it("scales with duration and body weight", () => {
    const base = estimateCaloriesBurned({
      category: "WEIGHTLIFTING",
      colorKey: "glutes_legs",
      durationMinutes: 60,
      bodyWeightLb: 150,
    })!;
    const longer = estimateCaloriesBurned({
      category: "WEIGHTLIFTING",
      colorKey: "glutes_legs",
      durationMinutes: 120,
      bodyWeightLb: 150,
    })!;
    const heavier = estimateCaloriesBurned({
      category: "WEIGHTLIFTING",
      colorKey: "glutes_legs",
      durationMinutes: 60,
      bodyWeightLb: 200,
    })!;
    expect(longer).toBeGreaterThan(base);
    expect(heavier).toBeGreaterThan(base);
    // Doubling the time roughly doubles the burn.
    expect(longer / base).toBeGreaterThan(1.8);
    expect(longer / base).toBeLessThan(2.2);
  });

  it("produces figures in a physiologically sane range", () => {
    // A 150 lb person lifting for an hour: a few hundred calories, not thousands.
    const lifting = estimateCaloriesBurned({
      category: "WEIGHTLIFTING",
      colorKey: "chest_triceps",
      durationMinutes: 60,
      bodyWeightLb: 150,
    })!;
    expect(lifting).toBeGreaterThan(200);
    expect(lifting).toBeLessThan(450);

    // Running burns meaningfully more than yoga for the same time.
    const running = estimateCaloriesBurned({
      category: "CARDIO",
      colorKey: "running",
      durationMinutes: 30,
      bodyWeightLb: 150,
    })!;
    const yoga = estimateCaloriesBurned({
      category: "FUN",
      colorKey: "yoga",
      durationMinutes: 30,
      bodyWeightLb: 150,
    })!;
    expect(running).toBeGreaterThan(yoga * 2);
  });

  it("falls back sensibly for unknown types and missing body weight", () => {
    expect(metValueFor("WEIGHTLIFTING", "some_custom_key")).toBeGreaterThan(0);
    const noWeight = estimateCaloriesBurned({
      category: "CARDIO",
      colorKey: null,
      durationMinutes: 45,
      bodyWeightLb: null,
    });
    expect(noWeight).not.toBeNull();
    expect(noWeight!).toBeGreaterThan(0);
  });

  it("returns null for a zero-length workout", () => {
    expect(
      estimateCaloriesBurned({
        category: "CARDIO",
        colorKey: "running",
        durationMinutes: 0,
        bodyWeightLb: 150,
      })
    ).toBeNull();
  });

  it("rounds to the precision the method justifies", () => {
    const value = estimateCaloriesBurned({
      category: "CARDIO",
      colorKey: "running",
      durationMinutes: 37,
      bodyWeightLb: 163,
    })!;
    expect(value % 5).toBe(0);
  });
});

describe("daily calorie status", () => {
  it("returns null when no goal is set, rather than a meaningless number", () => {
    expect(dailyCalorieStatus({ target: null, consumed: 500, burned: 0 })).toBeNull();
    expect(dailyCalorieStatus({ target: 0, consumed: 500, burned: 0 })).toBeNull();
  });

  it("credits exercise back against the day's budget", () => {
    const status = dailyCalorieStatus({ target: 2000, consumed: 1800, burned: 300 })!;
    expect(status.remaining).toBe(500);
  });

  it("goes negative when over budget instead of clamping", () => {
    const status = dailyCalorieStatus({ target: 2000, consumed: 2400, burned: 0 })!;
    expect(status.remaining).toBe(-400);
    expect(status.percentUsed).toBe(120);
  });

  it("reports percent used from food alone", () => {
    const status = dailyCalorieStatus({ target: 2000, consumed: 1000, burned: 500 })!;
    expect(status.percentUsed).toBe(50);
    expect(status.remaining).toBe(1500);
  });
});
