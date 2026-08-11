import type { BlockFocus, BlockFocusStyle, PrimaryGoal } from "@/lib/types/enums";

/**
 * Which focus a user's goal points at, and the rotation each goal follows
 * when blocks cycle. From the spec: Build Muscle -> Hypertrophy -> Strength
 * -> Power.
 */
const GOAL_ROTATION: Record<PrimaryGoal, BlockFocus[]> = {
  build_muscle: ["hypertrophy", "strength", "power"],
  build_strength: ["strength", "hypertrophy", "power"],
  lose_fat: ["conditioning", "hypertrophy", "strength"],
  stay_active: ["hypertrophy", "conditioning", "strength"],
  other: ["hypertrophy", "strength", "conditioning"],
};

/** The focus a "specialized" plan keeps returning to. */
export function dominantFocusForGoal(goal: PrimaryGoal): BlockFocus {
  return GOAL_ROTATION[goal][0];
}

/**
 * Orders the blocks of a plan.
 *
 * "balanced" walks the goal's rotation, so each block trains something
 * different. "specialized" alternates the goal's dominant focus with the
 * next quality in the rotation — hammering the goal while still varying
 * enough to avoid staleness (odd positions dominant, even positions
 * supporting).
 */
export function buildBlockSequence(
  goal: PrimaryGoal,
  style: BlockFocusStyle,
  blockCount: number
): BlockFocus[] {
  const rotation = GOAL_ROTATION[goal];
  const sequence: BlockFocus[] = [];

  for (let i = 0; i < blockCount; i++) {
    if (style === "balanced") {
      sequence.push(rotation[i % rotation.length]);
    } else {
      // specialized: dominant, support, dominant... but never spend the LAST
      // block on a supporting quality, or a 2-block plan ends up with the same
      // focus mix as "balanced" and the choice makes no visible difference.
      const isSupport = i % 2 === 1 && i < blockCount - 1;
      sequence.push(
        isSupport ? rotation[1 + (Math.floor(i / 2) % (rotation.length - 1))] : rotation[0]
      );
    }
  }
  return sequence;
}
