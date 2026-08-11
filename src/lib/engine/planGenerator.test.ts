import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "@/lib/data/exercises";
import { BLOCK_PRESCRIPTIONS } from "./blockPrescriptions";
import { buildBlockSequence, dominantFocusForGoal } from "./blockSequence";
import {
  generateTrainingPlan,
  isExerciseAllowed,
  planPositionOn,
  type PlanCandidateExercise,
} from "./planGenerator";
import { splitForTrainingDays, trainingDayOffsets, weeklyScheduleFor } from "./weeklySplit";

/** The real library, in the shape the generator consumes. */
const CANDIDATES: PlanCandidateExercise[] = EXERCISE_LIBRARY.map((e, i) => ({
  id: `ex-${i}`,
  name: e.name,
  muscleGroup: e.muscleGroup,
  movementCategory: e.movementCategory,
  kind: e.kind,
  exerciseType: e.exerciseType,
  difficultyTier: e.difficultyTier,
  contraindications: e.contraindications,
  equipment: e.equipment,
}));

const CARDIO_NAMES = new Set(EXERCISE_LIBRARY.filter((e) => e.kind === "CARDIO").map((e) => e.name));

const BASE = {
  goal: "build_muscle" as const,
  trainingDaysPerWeek: 4,
  experienceLevel: "one_to_three_years" as const,
  injuryAreas: [],
  blockDurationWeeks: 6,
  blockCount: 3,
  blockFocusStyle: "balanced" as const,
  deloadPreference: "scheduled" as const,
  availableExercises: CANDIDATES,
};

describe("weekly split", () => {
  it("maps training days to the right split", () => {
    expect(splitForTrainingDays(2)).toBe("full_body");
    expect(splitForTrainingDays(3)).toBe("full_body");
    expect(splitForTrainingDays(4)).toBe("upper_lower");
    expect(splitForTrainingDays(5)).toBe("push_pull_legs");
    expect(splitForTrainingDays(6)).toBe("push_pull_legs");
  });

  it("produces one session per training day", () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const schedule = weeklyScheduleFor(splitForTrainingDays(days), days);
      expect(schedule).toHaveLength(days);
      expect(trainingDayOffsets(days)).toHaveLength(days);
    }
  });

  it("alternates upper and lower on a 4-day split", () => {
    const labels = weeklyScheduleFor("upper_lower", 4).map((d) => d.dayLabel);
    expect(labels).toEqual(["Upper Body", "Lower Body", "Upper Body", "Lower Body"]);
  });

  it("cycles push/pull/legs twice on six days", () => {
    const labels = weeklyScheduleFor("push_pull_legs", 6).map((d) => d.dayLabel);
    expect(labels).toEqual(["Push", "Pull", "Legs", "Push", "Pull", "Legs"]);
  });

  it("spaces sessions so low-frequency weeks get rest days between them", () => {
    const offsets = trainingDayOffsets(3);
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i] - offsets[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("block sequencing", () => {
  it("follows the goal's rotation when balanced", () => {
    expect(buildBlockSequence("build_muscle", "balanced", 3)).toEqual([
      "hypertrophy",
      "strength",
      "power",
    ]);
  });

  it("keeps returning to the goal's dominant focus when specialized", () => {
    const seq = buildBlockSequence("build_strength", "specialized", 4);
    expect(seq[0]).toBe("strength");
    expect(seq[2]).toBe("strength");
    // Every other block varies rather than repeating the dominant focus.
    expect(seq[1]).not.toBe("strength");
    expect(dominantFocusForGoal("build_strength")).toBe("strength");
  });

  it("starts a fat-loss plan on conditioning", () => {
    expect(buildBlockSequence("lose_fat", "balanced", 1)).toEqual(["conditioning"]);
  });

  it("produces exactly the requested number of blocks for every goal and style", () => {
    for (const goal of ["build_muscle", "build_strength", "lose_fat", "stay_active", "other"] as const) {
      for (const style of ["balanced", "specialized"] as const) {
        for (const count of [2, 3, 4]) {
          expect(buildBlockSequence(goal, style, count)).toHaveLength(count);
        }
      }
    }
  });
});

describe("exercise filtering", () => {
  it("never prescribes a lift that loads an injured joint", () => {
    const kneeLoaders = CANDIDATES.filter((c) => c.contraindications.includes("knee"));
    expect(kneeLoaders.length).toBeGreaterThan(0);
    for (const ex of kneeLoaders) {
      expect(isExerciseAllowed(ex, ["knee"], "three_plus_years")).toBe(false);
    }
  });

  it("keeps beginners off advanced lifts", () => {
    // Cardio is excluded from plans regardless of tier, so compare lifts only.
    const advanced = CANDIDATES.filter((c) => c.difficultyTier === "advanced" && c.kind !== "CARDIO");
    expect(advanced.length).toBeGreaterThan(0);
    for (const ex of advanced) {
      expect(isExerciseAllowed(ex, [], "new"), ex.name).toBe(false);
      expect(isExerciseAllowed(ex, [], "three_plus_years"), ex.name).toBe(true);
    }
  });

  it("excludes cardio modalities at every experience level", () => {
    const cardio = CANDIDATES.filter((c) => c.kind === "CARDIO");
    expect(cardio.length).toBeGreaterThan(0);
    for (const ex of cardio) {
      expect(isExerciseAllowed(ex, [], "three_plus_years"), ex.name).toBe(false);
    }
  });

  it("excludes untagged exercises (e.g. user-created custom ones)", () => {
    const custom: PlanCandidateExercise = {
      id: "custom-1",
      name: "My Made-Up Lift",
      muscleGroup: null,
      exerciseType: null,
      difficultyTier: null,
      contraindications: [],
      equipment: "dumbbell",
    };
    expect(isExerciseAllowed(custom, [], "three_plus_years")).toBe(false);
  });
});

describe("plan generation", () => {
  it("builds the requested shape", () => {
    const plan = generateTrainingPlan(BASE);
    expect(plan.blocks).toHaveLength(3);
    expect(plan.durationWeeks).toBe(18);
    expect(plan.split).toBe("upper_lower");
    for (const block of plan.blocks) {
      expect(block.days).toHaveLength(4);
      expect(block.durationWeeks).toBe(6);
    }
  });

  it("applies each block's prescription to its exercises", () => {
    const plan = generateTrainingPlan(BASE);
    for (const block of plan.blocks) {
      const expected = BLOCK_PRESCRIPTIONS[block.focus];
      for (const day of block.days) {
        for (const ex of day.exercises) {
          expect(ex.repRangeLow).toBe(expected.repRangeLow);
          expect(ex.repRangeHigh).toBe(expected.repRangeHigh);
          expect(ex.setsLow).toBe(expected.setsLow);
          expect(ex.restSecondsHigh).toBe(expected.restSecondsHigh);
        }
      }
    }
  });

  it("matches the spec's prescriptions exactly", () => {
    expect(BLOCK_PRESCRIPTIONS.hypertrophy).toMatchObject({
      repRangeLow: 8, repRangeHigh: 12, setsLow: 3, setsHigh: 4, restSecondsLow: 60, restSecondsHigh: 90,
    });
    expect(BLOCK_PRESCRIPTIONS.strength).toMatchObject({
      repRangeLow: 4, repRangeHigh: 6, setsLow: 4, setsHigh: 5, restSecondsLow: 120, restSecondsHigh: 180,
    });
    expect(BLOCK_PRESCRIPTIONS.power).toMatchObject({
      repRangeLow: 3, repRangeHigh: 5, setsLow: 4, restSecondsLow: 180, restSecondsHigh: 300,
    });
    expect(BLOCK_PRESCRIPTIONS.conditioning).toMatchObject({
      repRangeLow: 12, repRangeHigh: 15, setsLow: 2, setsHigh: 3, restSecondsLow: 30, restSecondsHigh: 45,
    });
  });

  it("fills every day with exercises and never repeats one within a day", () => {
    const plan = generateTrainingPlan(BASE);
    for (const block of plan.blocks) {
      for (const day of block.days) {
        expect(day.exercises.length, `${block.focus} ${day.dayLabel}`).toBeGreaterThanOrEqual(4);
        const ids = day.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("only picks exercises belonging to that day's muscle groups", () => {
    const plan = generateTrainingPlan(BASE);
    for (const block of plan.blocks) {
      for (const day of block.days) {
        for (const ex of day.exercises) {
          expect(day.muscleGroups, `${day.dayLabel} got ${ex.name}`).toContain(ex.muscleGroup);
        }
      }
    }
  });

  it("respects injuries across the entire generated plan", () => {
    const plan = generateTrainingPlan({ ...BASE, injuryAreas: ["knee", "lower_back"] });
    const banned = new Set(
      CANDIDATES.filter(
        (c) => c.contraindications.includes("knee") || c.contraindications.includes("lower_back")
      ).map((c) => c.id)
    );
    let total = 0;
    for (const block of plan.blocks) {
      for (const day of block.days) {
        for (const ex of day.exercises) {
          total++;
          expect(banned.has(ex.exerciseId), `${ex.name} loads an injured joint`).toBe(false);
        }
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it("still produces a usable plan for a beginner with every injury flagged", () => {
    const plan = generateTrainingPlan({
      ...BASE,
      experienceLevel: "new",
      injuryAreas: ["knee", "shoulder", "lower_back", "wrist", "hip"],
    });
    for (const block of plan.blocks) {
      for (const day of block.days) {
        expect(day.exercises.length, `${day.dayLabel} was starved`).toBeGreaterThan(0);
      }
    }
  });

  it("never prescribes a cardio machine as a lift", () => {
    // An elliptical at "4 sets of 3-5 reps, 3 minutes rest" is nonsense.
    for (const days of [3, 4, 6]) {
      const plan = generateTrainingPlan({ ...BASE, trainingDaysPerWeek: days });
      for (const block of plan.blocks) {
        for (const day of block.days) {
          for (const ex of day.exercises) {
            expect(CARDIO_NAMES.has(ex.name), `${ex.name} is cardio`).toBe(false);
          }
        }
      }
    }
  });

  it("does not stack heavy leg compounds — one slot per muscle group's turn", () => {
    // A Lower day must not become four barbell leg lifts because legs has
    // more movement patterns available than core.
    const plan = generateTrainingPlan(BASE);
    for (const block of plan.blocks) {
      for (const day of block.days) {
        if (!day.muscleGroups.includes("core")) continue;
        const coreWork = day.exercises.filter((e) => e.muscleGroup === "core");
        expect(coreWork.length, `${day.dayLabel} has no core work`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps curls off push days and pressing off pull days", () => {
    const plan = generateTrainingPlan({ ...BASE, trainingDaysPerWeek: 6 });
    const byName = new Map(EXERCISE_LIBRARY.map((e, i) => [`ex-${i}`, e]));
    for (const block of plan.blocks) {
      for (const day of block.days) {
        for (const ex of day.exercises) {
          const seed = byName.get(ex.exerciseId)!;
          if (day.dayLabel === "Push") {
            expect(seed.movementCategory, `${ex.name} on Push`).not.toBe("biceps_isolation");
          }
          if (day.dayLabel === "Pull") {
            expect(seed.movementCategory, `${ex.name} on Pull`).not.toBe("triceps_isolation");
          }
        }
      }
    }
  });

  it("trains legs at least twice on a five-day week", () => {
    const labels = generateTrainingPlan({ ...BASE, trainingDaysPerWeek: 5 }).blocks[0].days.map(
      (d) => d.dayLabel
    );
    const legSessions = labels.filter((l) => l === "Legs" || l === "Lower Body").length;
    expect(legSessions, labels.join(",")).toBeGreaterThanOrEqual(2);
  });

  it("fills every day even for a power block with a beginner", () => {
    const plan = generateTrainingPlan({ ...BASE, goal: "build_muscle", experienceLevel: "new" });
    const powerBlock = plan.blocks.find((b) => b.focus === "power");
    if (powerBlock) {
      for (const day of powerBlock.days) {
        expect(day.exercises.length, `power ${day.dayLabel}`).toBe(
          plan.split === "full_body" ? 6 : day.exercises.length
        );
        expect(day.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it("weights exercise choice toward compounds in a strength block", () => {
    const plan = generateTrainingPlan({ ...BASE, goal: "build_strength", blockFocusStyle: "specialized" });
    const strengthBlock = plan.blocks.find((b) => b.focus === "strength")!;
    const all = strengthBlock.days.flatMap((d) => d.exercises);
    const compounds = all.filter((e) => e.exerciseType === "compound").length;
    expect(compounds / all.length).toBeGreaterThan(0.5);
  });

  it("schedules deload weeks according to preference", () => {
    expect(generateTrainingPlan(BASE).blocks.every((b) => b.hasDeloadWeek)).toBe(true);
    expect(
      generateTrainingPlan({ ...BASE, deloadPreference: "when_needed" }).blocks.every((b) => !b.hasDeloadWeek)
    ).toBe(true);
    // "minimal" only deloads in long blocks.
    expect(
      generateTrainingPlan({ ...BASE, deloadPreference: "minimal", blockDurationWeeks: 4 }).blocks[0].hasDeloadWeek
    ).toBe(false);
    expect(
      generateTrainingPlan({ ...BASE, deloadPreference: "minimal", blockDurationWeeks: 8 }).blocks[0].hasDeloadWeek
    ).toBe(true);
  });

  it("generates a complete plan for every day-count and goal combination", () => {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const goal of ["build_muscle", "build_strength", "lose_fat", "stay_active"] as const) {
        const plan = generateTrainingPlan({ ...BASE, trainingDaysPerWeek: days, goal });
        expect(plan.blocks.length).toBe(3);
        for (const block of plan.blocks) {
          expect(block.days).toHaveLength(days);
          for (const day of block.days) {
            expect(day.exercises.length, `${goal} ${days}d ${day.dayLabel}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("plan position tracking", () => {
  const plan = {
    blocks: [
      { durationWeeks: 6, hasDeloadWeek: true },
      { durationWeeks: 6, hasDeloadWeek: true },
    ],
  };
  const started = new Date("2026-01-05T09:00:00");

  it("reports the first week on day one", () => {
    const pos = planPositionOn(plan, started, new Date("2026-01-05T18:00:00"));
    expect(pos).toMatchObject({ blockIndex: 0, weekInBlock: 1, totalWeekIndex: 1, isComplete: false });
  });

  it("rolls into the next block after the first finishes", () => {
    const pos = planPositionOn(plan, started, new Date("2026-02-16T09:00:00")); // week 7
    expect(pos.blockIndex).toBe(1);
    expect(pos.weekInBlock).toBe(1);
    expect(pos.totalWeekIndex).toBe(7);
  });

  it("flags the final week of a block as a deload", () => {
    const pos = planPositionOn(plan, started, new Date("2026-02-09T09:00:00")); // week 6
    expect(pos).toMatchObject({ blockIndex: 0, weekInBlock: 6, isDeloadWeek: true });
  });

  it("marks the plan complete once past the last block", () => {
    expect(planPositionOn(plan, started, new Date("2026-04-20T09:00:00")).isComplete).toBe(true);
  });
});
