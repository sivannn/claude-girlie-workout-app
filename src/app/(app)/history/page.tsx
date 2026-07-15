import { PageHeader } from "@/components/shared/PageHeader";
import { StatDisplay } from "@/components/shared/StatDisplay";
import { FilterBar } from "./FilterBar";
import { WorkoutHistoryCard } from "./WorkoutHistoryCard";
import { getHistoryPageData } from "./data";
import type { WorkoutCategory } from "@/lib/types/enums";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const data = await getHistoryPageData({
    workoutTypeId: params.workoutTypeId,
    category: params.category as WorkoutCategory | undefined,
    prOnly: params.prOnly === "true",
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  return (
    <div>
      <PageHeader
        title="Past Workouts"
        subtitle="Your training journal — what you did, and how you've improved."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-4">
        <StatDisplay value={String(data.insights.totalWorkouts)} label="Total Workouts" size="sm" />
        <StatDisplay
          value={data.insights.mostImprovedExercise ? data.insights.mostImprovedExercise.name : "—"}
          label="Most Improved"
          sublabel={
            data.insights.mostImprovedExercise ? `+${data.insights.mostImprovedExercise.delta} lb` : undefined
          }
          size="sm"
        />
        <StatDisplay value={`${data.insights.longestStreak}w`} label="Longest Streak" size="sm" />
        <StatDisplay value={data.insights.mostFrequentType ?? "—"} label="Most Frequent" size="sm" />
      </div>

      <div className="mb-4">
        <FilterBar workoutTypes={data.workoutTypes} />
      </div>

      {data.items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No workouts match these filters yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((w) => (
            <WorkoutHistoryCard key={w.id} workout={w} />
          ))}
        </div>
      )}
    </div>
  );
}
