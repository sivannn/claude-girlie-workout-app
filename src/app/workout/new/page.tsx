import { getCurrentUser } from "@/lib/auth";
import { getWorkoutTypes } from "./actions";
import { StartWorkoutFlow } from "./StartWorkoutFlow";
import type { PickerGroup } from "./WorkoutTypeSelector";

// Reads live exercise/workout-type data from the database on every visit.
export const dynamic = "force-dynamic";

const VALID_GROUPS: PickerGroup[] = ["WEIGHTLIFTING", "CARDIO", "CLASS", "FUN_ACTIVITY", "FUN_ALL", "RECOVERY"];

export default async function StartWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; resume?: string; category?: string; date?: string }>;
}) {
  // This route sits outside the (app) group, so it needs its own session gate.
  await getCurrentUser();
  const [{ type, resume, category, date }, workoutTypes] = await Promise.all([
    searchParams,
    getWorkoutTypes(),
  ]);
  const initialCategory = VALID_GROUPS.includes(category as PickerGroup) ? (category as PickerGroup) : null;
  // "Log a previous workout" mode — the range itself is enforced server-side
  // on completion; here we only need a well-formed day.
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 md:px-8">
      <StartWorkoutFlow
        workoutTypes={workoutTypes}
        initialTypeId={type ?? null}
        initialResumeId={resume ?? null}
        initialCategory={initialCategory}
        targetDate={targetDate}
      />
    </div>
  );
}
