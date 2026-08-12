/**
 * The validation layer that makes AI coaching suggestions safe to act on.
 *
 * Alex may *propose* an adjustment to a generated session — a bigger jump when
 * someone is clearly outgrowing the increment, a lighter day when they've been
 * grinding, swapping an exercise they keep removing. Nothing proposed is ever
 * applied as given: every suggestion passes through these pure, tested bounds
 * first, and anything outside them is discarded.
 *
 * The rule that matters: a language model never decides what goes on the bar.
 * It can nudge a number the engine already computed, within limits the engine
 * enforces, or its suggestion is dropped.
 */

export type AdjustmentKind = "increase_weight" | "decrease_weight" | "swap_exercise";

/** What Alex proposed, before validation. */
export type ProposedAdjustment = {
  exerciseId: string;
  kind: AdjustmentKind;
  /** Percentage change for weight adjustments, e.g. 5 for +5%. */
  percent?: number;
  reason: string;
};

export type AppliedAdjustment = {
  exerciseId: string;
  kind: AdjustmentKind;
  /** The multiplier actually applied after clamping (1 = no change). */
  appliedMultiplier: number;
  reason: string;
};

export type AdjustmentContext = {
  exerciseId: string;
  /** No adjusting a weight the user has never actually lifted. */
  isFirstTime: boolean;
  /** The engine already cut this weight; don't let a suggestion fight a deload. */
  isDeload: boolean;
  /** Consecutive recent sessions where every set hit the top of the rep range. */
  sessionsAtTopOfRange: number;
  /** Times the user removed this exercise from a generated session. */
  timesRemoved: number;
};

/**
 * Hard bounds. A suggestion can nudge, never transform: at most a 10% increase
 * or a 10% reduction on a weight the engine already derived from real history.
 */
export const MAX_INCREASE_PERCENT = 10;
export const MAX_DECREASE_PERCENT = 10;
/** An increase is only justified once the user has genuinely outgrown the load. */
export const MIN_SESSIONS_AT_TOP_FOR_INCREASE = 2;
/** A swap needs real evidence the user dislikes the exercise, not a hunch. */
export const MIN_REMOVALS_FOR_SWAP = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validates one proposal against its context. Returns null when the suggestion
 * is unjustified, unsafe, or simply not supported by the user's own data —
 * which is the common case, and is fine.
 */
export function validateAdjustment(
  proposal: ProposedAdjustment,
  context: AdjustmentContext
): AppliedAdjustment | null {
  if (proposal.exerciseId !== context.exerciseId) return null;
  // Never adjust a weight with no history behind it: the engine's starting
  // estimate is already a guess, and a guess on a guess is not coaching.
  if (context.isFirstTime) return null;

  if (proposal.kind === "increase_weight") {
    // Don't push someone the engine just deloaded, and don't raise a load the
    // user hasn't actually been topping out.
    if (context.isDeload) return null;
    if (context.sessionsAtTopOfRange < MIN_SESSIONS_AT_TOP_FOR_INCREASE) return null;
    const percent = clamp(proposal.percent ?? 0, 0, MAX_INCREASE_PERCENT);
    if (percent <= 0) return null;
    return {
      exerciseId: proposal.exerciseId,
      kind: proposal.kind,
      appliedMultiplier: 1 + percent / 100,
      reason: proposal.reason,
    };
  }

  if (proposal.kind === "decrease_weight") {
    // Backing off is always allowed — erring toward lighter is the safe
    // direction — but still bounded, and never stacked on an existing deload.
    if (context.isDeload) return null;
    const percent = clamp(proposal.percent ?? 0, 0, MAX_DECREASE_PERCENT);
    if (percent <= 0) return null;
    return {
      exerciseId: proposal.exerciseId,
      kind: proposal.kind,
      appliedMultiplier: 1 - percent / 100,
      reason: proposal.reason,
    };
  }

  // swap_exercise: only when the user has actually removed it repeatedly.
  if (context.timesRemoved < MIN_REMOVALS_FOR_SWAP) return null;
  return {
    exerciseId: proposal.exerciseId,
    kind: "swap_exercise",
    appliedMultiplier: 1,
    reason: proposal.reason,
  };
}

/**
 * Validates a batch, discarding anything unjustified and capping how much of a
 * session a single suggestion pass may touch — a coach adjusts a lift or two,
 * not the whole workout.
 */
export const MAX_ADJUSTMENTS_PER_SESSION = 2;

export function validateAdjustments(
  proposals: ProposedAdjustment[],
  contexts: AdjustmentContext[]
): AppliedAdjustment[] {
  const byExercise = new Map(contexts.map((c) => [c.exerciseId, c]));
  const applied: AppliedAdjustment[] = [];
  const seen = new Set<string>();

  for (const proposal of proposals) {
    if (applied.length >= MAX_ADJUSTMENTS_PER_SESSION) break;
    if (seen.has(proposal.exerciseId)) continue;
    const context = byExercise.get(proposal.exerciseId);
    if (!context) continue;
    const result = validateAdjustment(proposal, context);
    if (result) {
      applied.push(result);
      seen.add(proposal.exerciseId);
    }
  }
  return applied;
}

/** Applies a validated multiplier to a weight, rounded the way the app rounds. */
export function adjustWeight(weight: number | null, multiplier: number): number | null {
  if (weight == null) return weight;
  return Math.max(5, Math.round((weight * multiplier) / 5) * 5);
}
