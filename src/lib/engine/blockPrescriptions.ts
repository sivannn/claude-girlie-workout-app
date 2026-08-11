import type { BlockFocus, DeloadPreference } from "@/lib/types/enums";

/**
 * Set/rep/rest prescriptions per block focus, straight from the Block
 * Periodization spec. These are *intents*: the plan stores them, and the
 * deterministic progression engine resolves them into concrete weights at
 * workout time against the user's actual logged history (so a plan written
 * eight weeks ago never fights reality).
 */
export type BlockPrescription = {
  repRangeLow: number;
  repRangeHigh: number;
  setsLow: number;
  setsHigh: number;
  restSecondsLow: number;
  restSecondsHigh: number;
};

export const BLOCK_PRESCRIPTIONS: Record<BlockFocus, BlockPrescription> = {
  hypertrophy: {
    repRangeLow: 8,
    repRangeHigh: 12,
    setsLow: 3,
    setsHigh: 4,
    restSecondsLow: 60,
    restSecondsHigh: 90,
  },
  strength: {
    repRangeLow: 4,
    repRangeHigh: 6,
    setsLow: 4,
    setsHigh: 5,
    restSecondsLow: 120,
    restSecondsHigh: 180,
  },
  power: {
    repRangeLow: 3,
    repRangeHigh: 5,
    setsLow: 4,
    setsHigh: 4,
    restSecondsLow: 180,
    restSecondsHigh: 300,
  },
  conditioning: {
    repRangeLow: 12,
    repRangeHigh: 15,
    setsLow: 2,
    setsHigh: 3,
    restSecondsLow: 30,
    restSecondsHigh: 45,
  },
};

export const BLOCK_FOCUS_LABEL: Record<BlockFocus, string> = {
  hypertrophy: "Hypertrophy",
  strength: "Strength",
  power: "Power",
  conditioning: "Conditioning",
};

/** One-line description of what a block is training, shown in plan UI. */
export const BLOCK_FOCUS_DESCRIPTION: Record<BlockFocus, string> = {
  hypertrophy: "Moderate weights, higher reps — the classic muscle-building range.",
  strength: "Heavier weights, lower reps, longer rests — getting genuinely stronger.",
  power: "Explosive work at low reps with full recovery between sets.",
  conditioning: "Lighter weights, higher reps, short rests — work capacity and endurance.",
};

/**
 * Whether a block's final week is a planned deload.
 *
 * "scheduled" plans one into every block. "when_needed" leaves the engine's
 * existing reactive stall-deload in charge (progression.ts drops 10% after
 * three stalled sessions). "minimal" only deloads in longer blocks, where
 * going 7-8 weeks without a break is a real fatigue risk.
 */
export function blockHasDeloadWeek(
  preference: DeloadPreference,
  durationWeeks: number
): boolean {
  if (preference === "scheduled") return true;
  if (preference === "minimal") return durationWeeks >= 7;
  return false;
}

/**
 * The load reduction a deload week calls for.
 *
 * NOT yet applied automatically to prescribed weights — the workout screen
 * still resolves loads purely from logged history via progression.ts. Today
 * this drives the guidance shown on the Home plan card ("take about 15% off");
 * wiring it into weight resolution is part of making the plan drive the
 * workout screen.
 */
export const DELOAD_LOAD_MULTIPLIER = 0.85;
