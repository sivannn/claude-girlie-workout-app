import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "./exercises";
import { EXERCISE_INSTRUCTIONS } from "./exercise-instructions";
import {
  DIFFICULTY_TIERS,
  EQUIPMENT_TYPES,
  EXERCISE_TYPES,
  INJURY_AREAS,
  MOVEMENT_CATEGORIES,
  MUSCLE_GROUPS,
  TRAINING_CATEGORIES,
} from "@/lib/types/enums";

// The library is the input to block-periodization exercise selection, so bad
// data here silently produces bad workouts. These guard the invariants the
// generator/plan engine relies on.

describe("exercise library", () => {
  it("is roughly the 200-exercise library the plan calls for", () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(180);
  });

  it("has unique names", () => {
    const names = EXERCISE_LIBRARY.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only uses known enum values on every entry", () => {
    for (const ex of EXERCISE_LIBRARY) {
      expect(TRAINING_CATEGORIES, ex.name).toContain(ex.workoutCategory);
      expect(MOVEMENT_CATEGORIES, ex.name).toContain(ex.movementCategory);
      expect(MUSCLE_GROUPS, ex.name).toContain(ex.muscleGroup);
      expect(EXERCISE_TYPES, ex.name).toContain(ex.exerciseType);
      expect(DIFFICULTY_TIERS, ex.name).toContain(ex.difficultyTier);
      expect(EQUIPMENT_TYPES, ex.name).toContain(ex.equipment);
      for (const area of ex.contraindications) {
        expect(INJURY_AREAS, ex.name).toContain(area);
      }
    }
  });

  it("has sane rep ranges and progression increments", () => {
    for (const ex of EXERCISE_LIBRARY) {
      if (ex.repRangeLow != null && ex.repRangeHigh != null) {
        expect(ex.repRangeLow, ex.name).toBeLessThanOrEqual(ex.repRangeHigh);
        expect(ex.repRangeLow, ex.name).toBeGreaterThan(0);
        expect(ex.repRangeHigh, ex.name).toBeLessThanOrEqual(40);
      }
      // Bodyweight moves may still carry an increment — plenty are loadable
      // (weighted glute bridges, dips, pull-ups) — but any increment present
      // has to be a realistic per-session jump.
      if (ex.defaultIncrementLb != null) {
        expect(ex.defaultIncrementLb, ex.name).toBeGreaterThan(0);
        expect(ex.defaultIncrementLb, ex.name).toBeLessThanOrEqual(25);
      }
    }
  });

  it("ships instructions for every exercise, in the plain-text format the UI renders", () => {
    for (const ex of EXERCISE_LIBRARY) {
      const text = EXERCISE_INSTRUCTIONS[ex.name];
      expect(text, `missing instructions: ${ex.name}`).toBeTruthy();
      expect(text.length, ex.name).toBeLessThan(900);
      // The dialog renders raw text — markdown would show as literal characters.
      expect(text, ex.name).not.toMatch(/[#*]/);
      expect(text, ex.name).toMatch(/^1\./);
    }
  });

  it("has no orphaned instruction entries", () => {
    const names = new Set(EXERCISE_LIBRARY.map((e) => e.name));
    for (const name of Object.keys(EXERCISE_INSTRUCTIONS)) {
      expect(names.has(name), `instructions for unknown exercise: ${name}`).toBe(true);
    }
  });

  it("can still build a workout for someone with every injury flagged", () => {
    // The selection engine must never be starved by injury filtering: each
    // lifting category needs survivors when all five areas are excluded.
    for (const category of ["glutes_legs", "chest_triceps", "back_biceps", "abs"] as const) {
      const usable = EXERCISE_LIBRARY.filter(
        (e) => e.workoutCategory === category && e.contraindications.length === 0
      );
      expect(usable.length, `no injury-safe exercises for ${category}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("covers every muscle group and difficulty tier", () => {
    for (const group of MUSCLE_GROUPS) {
      expect(
        EXERCISE_LIBRARY.filter((e) => e.muscleGroup === group).length,
        `thin coverage for ${group}`
      ).toBeGreaterThanOrEqual(8);
    }
    for (const tier of DIFFICULTY_TIERS) {
      expect(
        EXERCISE_LIBRARY.filter((e) => e.difficultyTier === tier).length,
        `thin coverage for ${tier}`
      ).toBeGreaterThanOrEqual(15);
    }
  });

  it("offers bodyweight-only options in every lifting category", () => {
    for (const category of ["glutes_legs", "chest_triceps", "back_biceps", "abs"] as const) {
      const bodyweight = EXERCISE_LIBRARY.filter(
        (e) => e.workoutCategory === category && (e.equipment === "bodyweight" || e.equipment === "bands")
      );
      expect(bodyweight.length, `no home-training options for ${category}`).toBeGreaterThanOrEqual(3);
    }
  });
});
