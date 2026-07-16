import type { EquipmentAccess, EquipmentType } from "@/lib/types/enums";

// What's realistically available at each training location. Used to filter
// exercise recommendations so users are never handed something they can't
// actually do.
export const EQUIPMENT_ACCESS_ALLOWED: Record<EquipmentAccess, EquipmentType[]> = {
  commercial_gym: ["barbell", "dumbbell", "cable", "machine", "bodyweight", "bands"],
  home_gym: ["barbell", "dumbbell", "bodyweight", "bands"],
  apartment_gym: ["dumbbell", "machine", "bodyweight", "bands"],
  bodyweight_only: ["bodyweight", "bands"],
};

/**
 * Filters a list of exercises down to what the user can actually perform
 * given their equipment access. Custom (user-added) exercises have no
 * equipment tag and are always kept, since we don't know their constraints.
 */
export function filterExercisesByEquipment<T extends { equipment?: string | null }>(
  exercises: T[],
  equipmentAccess: EquipmentAccess | null | undefined
): T[] {
  if (!equipmentAccess) return exercises;
  const allowed = new Set<string>(EQUIPMENT_ACCESS_ALLOWED[equipmentAccess]);
  return exercises.filter((e) => !e.equipment || allowed.has(e.equipment));
}
