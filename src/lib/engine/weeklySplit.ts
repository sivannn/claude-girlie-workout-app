import type { MuscleGroup, WeeklySplit } from "@/lib/types/enums";

/**
 * The weekly training split, chosen from how many days a week the user can
 * actually train (spec: "Generate a consistent weekly split from days/week
 * and goal — PPL, Upper/Lower, or Full Body").
 *
 * 2-3 days -> full body (each session must cover everything)
 * 4 days   -> upper/lower (the classic 4-day split)
 * 5-6 days -> push/pull/legs (enough days to give each pattern its own session)
 */
export function splitForTrainingDays(daysPerWeek: number): WeeklySplit {
  if (daysPerWeek <= 3) return "full_body";
  if (daysPerWeek === 4) return "upper_lower";
  return "push_pull_legs";
}

export const SPLIT_LABEL: Record<WeeklySplit, string> = {
  full_body: "Full Body",
  upper_lower: "Upper / Lower",
  push_pull_legs: "Push / Pull / Legs",
};

/**
 * A single training day within a week: which muscle groups it trains and how
 * many exercises it should hold.
 *
 * dayLabel doubles as the display name and as the key the workout generator
 * uses to pick exercises, so it stays stable across a plan.
 */
export type PlanDayTemplate = {
  dayLabel: string;
  muscleGroups: MuscleGroup[];
  exerciseCount: number;
  /**
   * Movement patterns this day must not prescribe. The "arms" muscle group
   * covers both biceps and triceps, which is fine on an Upper day but wrong
   * on a push/pull split — without this, Pull day programs triceps work and
   * Push day programs curls.
   */
  excludeMovementCategories?: string[];
};

const FULL_BODY: PlanDayTemplate = {
  dayLabel: "Full Body",
  muscleGroups: ["legs", "chest", "back", "shoulders", "arms", "core"],
  exerciseCount: 6,
};

const UPPER: PlanDayTemplate = {
  dayLabel: "Upper Body",
  muscleGroups: ["chest", "back", "shoulders", "arms"],
  exerciseCount: 6,
};

const LOWER: PlanDayTemplate = {
  dayLabel: "Lower Body",
  muscleGroups: ["legs", "core"],
  exerciseCount: 6,
};

const PUSH: PlanDayTemplate = {
  dayLabel: "Push",
  muscleGroups: ["chest", "shoulders", "arms"],
  exerciseCount: 5,
  // Arms on a push day means triceps only; pulling patterns belong on Pull.
  excludeMovementCategories: ["biceps_isolation", "horizontal_pull", "vertical_pull"],
};

const PULL: PlanDayTemplate = {
  dayLabel: "Pull",
  muscleGroups: ["back", "arms"],
  exerciseCount: 5,
  // Arms on a pull day means biceps only.
  // Also bars pressing patterns: a close-grip bench is tagged muscleGroup
  // "arms" but is emphatically a push movement.
  excludeMovementCategories: [
    "triceps_isolation",
    "chest_isolation",
    "shoulder_isolation",
    "horizontal_push",
    "vertical_push",
  ],
};

const LEGS: PlanDayTemplate = {
  dayLabel: "Legs",
  muscleGroups: ["legs", "core"],
  exerciseCount: 5,
};

/**
 * The ordered training days of one week. Sessions are laid out so the same
 * muscle group is never trained on back-to-back days where the split allows
 * it (e.g. 6-day PPL runs push/pull/legs twice rather than doubling up).
 */
export function weeklyScheduleFor(split: WeeklySplit, daysPerWeek: number): PlanDayTemplate[] {
  if (split === "full_body") {
    return Array.from({ length: daysPerWeek }, () => FULL_BODY);
  }
  if (split === "upper_lower") {
    const cycle = [UPPER, LOWER];
    return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % cycle.length]);
  }
  // Five days doesn't divide the three-day cycle: truncating it would give
  // push and pull two sessions and legs only one. Cap the week with
  // Upper/Lower so every pattern gets trained twice.
  if (daysPerWeek === 5) return [PUSH, PULL, LEGS, UPPER, LOWER];
  const cycle = [PUSH, PULL, LEGS];
  return Array.from({ length: daysPerWeek }, (_, i) => cycle[i % cycle.length]);
}

/**
 * Which calendar weekdays a plan week lands on, spread as evenly as possible
 * so rest days fall between sessions. Returned as day-of-week offsets from
 * the week's start (0 = first day of the training week).
 */
export function trainingDayOffsets(daysPerWeek: number): number[] {
  // Hand-picked spacings beat naive division: these keep at least one rest
  // day between sessions wherever the day count allows it.
  const SPACINGS: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  };
  return SPACINGS[daysPerWeek] ?? SPACINGS[3];
}
