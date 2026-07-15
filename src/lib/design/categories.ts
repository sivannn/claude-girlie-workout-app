import type { WorkoutCategory } from "@/lib/types/enums";
import type { EventStatus } from "@/lib/types/enums";

/**
 * Two-level color system (see Calendar spec):
 *   Level 1: base color family per WorkoutCategory (Weightlifting/Cardio/Fun/Recovery)
 *   Level 2: a shade per subtype, keyed by `colorKey` on WorkoutType
 *
 * Every color lives as a CSS custom property (src/app/globals.css) so this
 * module is just a typed lookup table — components read the color via
 * `categoryColorVar()` and apply it with an inline style, since Tailwind's
 * JIT scanner can't see dynamically-built class names like `bg-cat-${key}`.
 */

export const CATEGORY_FAMILY_VAR: Record<WorkoutCategory, string> = {
  WEIGHTLIFTING: "--cat-family-weightlifting",
  CARDIO: "--cat-family-cardio",
  FUN: "--cat-family-fun",
  RECOVERY: "--cat-family-recovery",
};

export const CATEGORY_FAMILY_LABEL: Record<WorkoutCategory, string> = {
  WEIGHTLIFTING: "Weightlifting",
  CARDIO: "Cardio",
  FUN: "Fun / Lifestyle",
  RECOVERY: "Recovery / Maintenance",
};

export type SubtypeMeta = {
  /** CSS custom property name (without var()) holding this subtype's shade */
  cssVar: string;
  label: string;
  family: WorkoutCategory;
};

// colorKey -> subtype metadata. Custom ("Other") workout types fall back to
// the family's generic `custom` shade for whichever family the user assigns.
export const SUBTYPE_META: Record<string, SubtypeMeta> = {
  // Weightlifting (A)
  glutes_legs: { cssVar: "--cat-glutes-legs", label: "Glutes & Legs", family: "WEIGHTLIFTING" },
  chest_triceps: { cssVar: "--cat-chest-triceps", label: "Chest & Triceps", family: "WEIGHTLIFTING" },
  back_biceps: { cssVar: "--cat-back-biceps", label: "Back & Biceps", family: "WEIGHTLIFTING" },
  abs: { cssVar: "--cat-abs", label: "Abs", family: "WEIGHTLIFTING" },

  // Cardio (B)
  running: { cssVar: "--cat-running", label: "Running", family: "CARDIO" },
  incline_walking: { cssVar: "--cat-incline-walking", label: "Incline Walking", family: "CARDIO" },
  stairs: { cssVar: "--cat-stairs", label: "Stairs", family: "CARDIO" },
  swimming: { cssVar: "--cat-swimming", label: "Swimming", family: "CARDIO" },
  cycling: { cssVar: "--cat-cycling", label: "Cycling", family: "CARDIO" },

  // Fun / Lifestyle (C)
  yoga: { cssVar: "--cat-yoga", label: "Yoga", family: "FUN" },
  pilates: { cssVar: "--cat-pilates", label: "Pilates", family: "FUN" },
  pickleball: { cssVar: "--cat-pickleball", label: "Pickleball", family: "FUN" },
  hiking: { cssVar: "--cat-hiking", label: "Hiking", family: "FUN" },

  // Recovery / Maintenance (D)
  mobility: { cssVar: "--cat-mobility", label: "Mobility Work", family: "RECOVERY" },
  stretching: { cssVar: "--cat-stretching", label: "Stretching", family: "RECOVERY" },
  light_walk: { cssVar: "--cat-light-walk", label: "Light Walk", family: "RECOVERY" },
  rehab: { cssVar: "--cat-rehab", label: "Rehab Work", family: "RECOVERY" },

  // Generic fallback shades for user-created "Other" workout types
  custom_weightlifting: { cssVar: "--cat-custom-weightlifting", label: "Custom", family: "WEIGHTLIFTING" },
  custom_cardio: { cssVar: "--cat-custom-cardio", label: "Custom", family: "CARDIO" },
  custom_fun: { cssVar: "--cat-custom-fun", label: "Custom", family: "FUN" },
  custom_recovery: { cssVar: "--cat-custom-recovery", label: "Custom", family: "RECOVERY" },
};

export function categoryColorVar(colorKey: string): string {
  const meta = SUBTYPE_META[colorKey];
  return `var(${meta?.cssVar ?? CATEGORY_FAMILY_VAR.RECOVERY})`;
}

export function categoryLabel(colorKey: string): string {
  return SUBTYPE_META[colorKey]?.label ?? colorKey;
}

export function categoryFamily(colorKey: string): WorkoutCategory {
  return SUBTYPE_META[colorKey]?.family ?? "RECOVERY";
}

/**
 * Visual treatment per Workout Event state (Calendar spec):
 * Planned = outlined, Completed = solid filled, Missed = faded/desaturated
 * outline, In Progress = active/pulsing solid.
 */
export function eventStatusStyle(
  colorKey: string,
  status: EventStatus
): { background: string; border: string; color: string; opacity?: number } {
  const color = categoryColorVar(colorKey);
  switch (status) {
    case "COMPLETED":
      return { background: color, border: color, color: "var(--cat-on-fill)" };
    case "IN_PROGRESS":
      return { background: color, border: color, color: "var(--cat-on-fill)" };
    case "MISSED":
      return { background: "transparent", border: color, color, opacity: 0.45 };
    case "PLANNED":
    default:
      return { background: "transparent", border: color, color };
  }
}
