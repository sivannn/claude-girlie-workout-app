import { describe, expect, it } from "vitest";
import { selectExercisesForWorkout, type RecentSlotPick } from "./exerciseSelection";
import type { EngineExercise, EngineExercisePreference } from "./types";

function ex(id: string, movementCategory: EngineExercise["movementCategory"]): EngineExercise {
  return {
    id,
    name: id,
    workoutCategory: "glutes_legs",
    movementCategory,
    kind: "STRENGTH",
    repRangeLow: 8,
    repRangeHigh: 12,
    defaultIncrementLb: 5,
  };
}

const exercises: EngineExercise[] = [
  ex("squat", "squat_lunge"),
  ex("lunge", "squat_lunge"),
  ex("rdl", "hip_hinge"),
  ex("hip_thrust", "hip_thrust_bridge"),
  ex("abduction", "glute_abduction"),
  ex("leg_curl", "hamstring_isolation"),
  ex("glute_iso", "glute_isolation"),
  ex("single_leg", "single_leg_stability"),
  ex("adductor", "adductors"),
  ex("calf", "calves"),
];

const noPrefs: EngineExercisePreference[] = [];

describe("selectExercisesForWorkout", () => {
  it("fills every required movement-pattern slot for Leg Day plus one rotating slot", () => {
    const selected = selectExercisesForWorkout("glutes_legs", exercises, noPrefs, []);
    expect(selected).toHaveLength(5);
    const categories = selected.map((s) => s.movementCategory);
    expect(categories).toEqual(
      expect.arrayContaining(["squat_lunge", "hip_hinge", "hip_thrust_bridge", "glute_abduction"])
    );
  });

  it("repeats the same required-slot exercise as last time for progression continuity", () => {
    const recentPicks: RecentSlotPick[] = [
      { movementCategory: "squat_lunge", exerciseId: "lunge", date: new Date("2026-07-07") },
    ];
    const selected = selectExercisesForWorkout("glutes_legs", exercises, noPrefs, recentPicks);
    const squatSlot = selected.find((s) => s.movementCategory === "squat_lunge");
    expect(squatSlot?.exercise.id).toBe("lunge");
  });

  it("swaps away from a required-slot exercise the user has consistently removed", () => {
    const recentPicks: RecentSlotPick[] = [
      { movementCategory: "squat_lunge", exerciseId: "lunge", date: new Date("2026-07-07") },
    ];
    const prefs: EngineExercisePreference[] = [
      { exerciseId: "lunge", priority: "MEDIUM", timesRemoved: 4, timesSelected: 4, lastRecommendedAt: null },
    ];
    const selected = selectExercisesForWorkout("glutes_legs", exercises, prefs, recentPicks);
    const squatSlot = selected.find((s) => s.movementCategory === "squat_lunge");
    expect(squatSlot?.exercise.id).not.toBe("lunge");
  });

  it("never selects the same exercise twice in one workout", () => {
    const selected = selectExercisesForWorkout("glutes_legs", exercises, noPrefs, []);
    const ids = selected.map((s) => s.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rotates the 5th slot toward the least-recently-trained movement category", () => {
    const recentPicks: RecentSlotPick[] = [
      { movementCategory: "hamstring_isolation", exerciseId: "leg_curl", date: new Date("2026-07-07") },
      { movementCategory: "glute_isolation", exerciseId: "glute_iso", date: new Date("2026-06-01") },
    ];
    const selected = selectExercisesForWorkout("glutes_legs", exercises, noPrefs, recentPicks);
    const rotatingSlot = selected.find((s) => !s.isRequiredSlot);
    // glute_isolation was trained longer ago than hamstring_isolation, and the
    // other rotating-pool categories have never been trained at all — so the
    // rotation should favor an untrained category over the two used above.
    expect(["single_leg_stability", "adductors", "calves"]).toContain(rotatingSlot?.movementCategory);
  });
});
