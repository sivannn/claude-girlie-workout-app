import type { MovementCategory } from "@/lib/types/enums";

export const MOVEMENT_CATEGORY_LABELS: Record<MovementCategory, string> = {
  squat_lunge: "Squat / Lunge",
  hip_hinge: "Hip Hinge",
  hip_thrust_bridge: "Hip Thrust / Bridge",
  glute_abduction: "Glute Abduction",
  hamstring_isolation: "Hamstring Isolation",
  glute_isolation: "Glute Isolation",
  single_leg_stability: "Single-Leg Stability",
  adductors: "Adductors",
  calves: "Calves",
  horizontal_push: "Horizontal Push",
  vertical_push: "Vertical Push",
  triceps_isolation: "Triceps Isolation",
  chest_isolation: "Chest Isolation",
  shoulder_isolation: "Shoulder Isolation",
  vertical_pull: "Vertical Pull",
  horizontal_pull: "Horizontal Pull",
  biceps_isolation: "Biceps Isolation",
  core: "Core",
  other: "Other",
};

export function movementCategoryLabel(category: MovementCategory): string {
  return MOVEMENT_CATEGORY_LABELS[category] ?? category;
}
