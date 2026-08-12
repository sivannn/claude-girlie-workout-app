import { describe, expect, it } from "vitest";
import { generatePlannedWorkout } from "./generateWorkout";
import { DELOAD_LOAD_MULTIPLIER } from "./blockPrescriptions";
import type { EngineExercise, EngineExerciseSession } from "./types";

const squat: EngineExercise = {
  id: "squat",
  name: "Barbell Squat",
  workoutCategory: "glutes_legs",
  movementCategory: "squat_lunge",
  kind: "STRENGTH",
  repRangeLow: 8,
  repRangeHigh: 12,
  defaultIncrementLb: 5,
};

const bench: EngineExercise = {
  id: "bench",
  name: "Barbell Bench Press",
  workoutCategory: "chest_triceps",
  movementCategory: "horizontal_push",
  kind: "STRENGTH",
  repRangeLow: 8,
  repRangeHigh: 12,
  defaultIncrementLb: 5,
};

/** A session where every set hit the top of the range, so progression adds weight. */
function historyAt(weight: number, reps: number, date: Date): EngineExerciseSession[] {
  return [
    {
      date,
      sets: [1, 2, 3].map((setNumber) => ({
        setNumber,
        recommendedWeight: weight,
        actualWeight: weight,
        recommendedRepsLow: 8,
        recommendedRepsHigh: 12,
        actualReps: reps,
      })),
    },
  ];
}

const ASOF = new Date("2026-08-11T10:00:00");
const LAST_WEEK = new Date("2026-08-04T10:00:00");

const planned = [
  { exercise: squat, movementCategory: "squat_lunge" as const },
  { exercise: bench, movementCategory: "horizontal_push" as const },
];

describe("plan-driven workout generation", () => {
  it("uses exactly the plan's exercises, in order", () => {
    const workout = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: planned,
      exerciseHistories: new Map(),
      asOfDate: ASOF,
      overrides: { repRangeLow: 4, repRangeHigh: 6, workingSetCount: 5, loadMultiplier: 1 },
    });
    expect(workout.exercises.map((e) => e.exercise.name)).toEqual([
      "Barbell Squat",
      "Barbell Bench Press",
    ]);
    // The plan supplies the whole session; no auto-appended ab exercise.
    expect(workout.abExercise).toBeNull();
  });

  it("applies the block's rep range and set count instead of exercise defaults", () => {
    const workout = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: planned,
      exerciseHistories: new Map([["squat", historyAt(100, 12, LAST_WEEK)]]),
      asOfDate: ASOF,
      overrides: { repRangeLow: 4, repRangeHigh: 6, workingSetCount: 5, loadMultiplier: 1 },
    });
    for (const ex of workout.exercises) {
      // Squat's own range is 8-12; the strength block's 4-6 wins.
      expect(ex.workingSets).toHaveLength(5);
      for (const set of ex.workingSets) {
        expect(set.repsLow).toBe(4);
        expect(set.repsHigh).toBe(6);
      }
    }
  });

  it("still derives weight from logged history, not from the plan", () => {
    const workout = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: [planned[0]],
      // Topped the range at 100 lb last week -> progression adds the increment.
      exerciseHistories: new Map([["squat", historyAt(100, 12, LAST_WEEK)]]),
      asOfDate: ASOF,
      overrides: { repRangeLow: 8, repRangeHigh: 12, workingSetCount: 3, loadMultiplier: 1 },
    });
    const top = workout.exercises[0].workingSets.at(-1)!.weight!;
    expect(top).toBeGreaterThan(100);
  });

  it("scales working weights down on a deload week", () => {
    const normal = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: [planned[0]],
      exerciseHistories: new Map([["squat", historyAt(200, 12, LAST_WEEK)]]),
      asOfDate: ASOF,
      overrides: { repRangeLow: 8, repRangeHigh: 12, workingSetCount: 3, loadMultiplier: 1 },
    });
    const deload = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: [planned[0]],
      exerciseHistories: new Map([["squat", historyAt(200, 12, LAST_WEEK)]]),
      asOfDate: ASOF,
      overrides: {
        repRangeLow: 8,
        repRangeHigh: 12,
        workingSetCount: 3,
        loadMultiplier: DELOAD_LOAD_MULTIPLIER,
      },
    });
    const normalTop = normal.exercises[0].workingSets.at(-1)!.weight!;
    const deloadTop = deload.exercises[0].workingSets.at(-1)!.weight!;
    expect(deloadTop).toBeLessThan(normalTop);
    // ~15% off, allowing for rounding to the nearest 5 lb.
    expect(deloadTop).toBeGreaterThan(normalTop * 0.8);
    expect(deloadTop % 5).toBe(0);
  });

  it("scales the warmup on a deload week too", () => {
    const deload = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: [planned[0]],
      exerciseHistories: new Map([["squat", historyAt(200, 12, LAST_WEEK)]]),
      asOfDate: ASOF,
      overrides: {
        repRangeLow: 8,
        repRangeHigh: 12,
        workingSetCount: 3,
        loadMultiplier: DELOAD_LOAD_MULTIPLIER,
      },
    });
    const warmup = deload.exercises[0].warmup.weight;
    expect(warmup).not.toBeNull();
    expect(warmup! % 5).toBe(0);
  });

  it("handles a first-time exercise with no history", () => {
    const workout = generatePlannedWorkout({
      trainingCategory: "glutes_legs",
      plannedExercises: [planned[0]],
      exerciseHistories: new Map(),
      startingWeightHints: new Map([["squat", 95]]),
      asOfDate: ASOF,
      overrides: { repRangeLow: 8, repRangeHigh: 12, workingSetCount: 3, loadMultiplier: 1 },
    });
    expect(workout.exercises[0].isFirstTime).toBe(true);
    expect(workout.exercises[0].workingSets.at(-1)!.weight).toBe(95);
  });
});
