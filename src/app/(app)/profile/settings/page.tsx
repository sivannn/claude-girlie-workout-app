import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import type {
  BlockFocusStyle,
  DeloadPreference,
  EquipmentAccess,
  ExperienceLevel,
  InjuryArea,
  PrimaryGoal,
  TrainingCategory,
  WorkoutPreference,
} from "@/lib/types/enums";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

function parseJsonList<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  const prefs = user.preferences;

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Account Settings"
        subtitle="Your answers from the intro questionnaire — everything here is editable, exactly as Alex promised."
      />
      <SettingsForm
        initial={{
          primaryGoal: (prefs?.primaryGoal ?? "stay_active") as PrimaryGoal,
          musclePriorities: parseJsonList<TrainingCategory>(prefs?.musclePriorities),
          workoutPreferences: parseJsonList<WorkoutPreference>(prefs?.workoutPreferences),
          equipmentAccess: (prefs?.equipmentAccess ?? "bodyweight_only") as EquipmentAccess,
          experienceLevel: (prefs?.experienceLevel ?? "new") as ExperienceLevel,
          bodyWeightLb: prefs?.bodyWeightLb ?? null,
          monthlyWorkoutTarget: prefs?.monthlyWorkoutTarget ?? 18,
          trainingDaysPerWeek: prefs?.trainingDaysPerWeek ?? 3,
          injuryAreas: parseJsonList<InjuryArea>(prefs?.injuryAreas),
          injuryNote: prefs?.injuryNote ?? null,
          blockDurationWeeks: prefs?.blockDurationWeeks ?? 6,
          blockCount: prefs?.blockCount ?? 3,
          blockFocusStyle: (prefs?.blockFocusStyle ?? "balanced") as BlockFocusStyle,
          deloadPreference: (prefs?.deloadPreference ?? "scheduled") as DeloadPreference,
        }}
      />
    </div>
  );
}
