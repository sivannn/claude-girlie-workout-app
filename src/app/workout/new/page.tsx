import { getWorkoutTypes } from "./actions";
import { StartWorkoutFlow } from "./StartWorkoutFlow";
import type { PickerGroup } from "./WorkoutTypeSelector";

// Reads live exercise/workout-type data from the database on every visit.
export const dynamic = "force-dynamic";

const VALID_GROUPS: PickerGroup[] = ["WEIGHTLIFTING", "CARDIO", "CLASS", "FUN_ACTIVITY", "FUN_ALL", "RECOVERY"];

export default async function StartWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; resume?: string; category?: string }>;
}) {
  const [{ type, resume, category }, workoutTypes] = await Promise.all([searchParams, getWorkoutTypes()]);
  const initialCategory = VALID_GROUPS.includes(category as PickerGroup) ? (category as PickerGroup) : null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 md:px-8">
      <StartWorkoutFlow
        workoutTypes={workoutTypes}
        initialTypeId={type ?? null}
        initialResumeId={resume ?? null}
        initialCategory={initialCategory}
      />
    </div>
  );
}
