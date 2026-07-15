import { getWorkoutTypes } from "./actions";
import { StartWorkoutFlow } from "./StartWorkoutFlow";

export default async function StartWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, workoutTypes] = await Promise.all([searchParams, getWorkoutTypes()]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 md:px-8">
      <StartWorkoutFlow workoutTypes={workoutTypes} initialTypeId={type ?? null} />
    </div>
  );
}
