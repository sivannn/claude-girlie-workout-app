import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { AlexNote } from "@/components/shared/AlexNote";
import { StatDisplay } from "@/components/shared/StatDisplay";
import { ProgressBarLabeled } from "@/components/shared/ProgressBarLabeled";
import { StrengthProgressChart } from "./StrengthProgressChart";
import { BodyWeightChart } from "./BodyWeightChart";
import { WorkoutBalanceChart } from "./WorkoutBalanceChart";
import { getProgressPageData } from "./data";

const ACHIEVEMENT_ICON: Record<string, string> = {
  PR: "🏆",
  GOAL_COMPLETED: "🎯",
  STREAK: "🔥",
  MILESTONE_COUNT: "✨",
  OTHER: "⭐",
};

export default async function ProgressPage() {
  const data = await getProgressPageData();

  return (
    <div>
      <PageHeader title="Progress & Milestones" subtitle="Where you've been, over the long run." />

      <div className="flex flex-col gap-8">
        {data.overviewInsight ? <AlexNote>{data.overviewInsight}</AlexNote> : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your Journey</h2>
          <div className="tile grid grid-cols-3 gap-4 rounded-xl border p-4">
            <StatDisplay value={String(data.journey.totalWorkouts)} label="Total Workouts" size="sm" />
            <StatDisplay
              value={data.journey.mostImprovedExercise ? `+${data.journey.mostImprovedExercise.delta} lb` : "—"}
              label="Most Improved"
              sublabel={data.journey.mostImprovedExercise?.name}
              size="sm"
            />
            <StatDisplay value={data.journey.mostFrequentType ?? "—"} label="Most Frequent" size="sm" />
          </div>
        </section>

        {data.activeGoals.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Goal Progress</h2>
            <div className="flex flex-col gap-3">
              {data.activeGoals.map((g) => (
                <ProgressBarLabeled
                  key={g.id}
                  label={g.title}
                  current={g.currentBest - g.startingValue}
                  total={g.targetValue - g.startingValue}
                  formatValue={`${g.currentBest} / ${g.targetValue} ${g.unit}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Strength Progress</h2>
          <p className="text-xs text-muted-foreground">Last 100 days</p>
          <StrengthProgressChart series={data.strengthSeries} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Consistency</h2>
          <div className="tile grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-4">
            <StatDisplay value={String(data.consistency.currentStreak)} label="Current Streak" size="sm" />
            <StatDisplay value={String(data.consistency.longestStreak)} label="Longest Streak" size="sm" />
            <StatDisplay
              value={`${data.consistency.monthlyCompleted}/${data.consistency.monthlyTarget}`}
              label="This Month"
              size="sm"
            />
            <StatDisplay
              value={`${data.consistency.weeklyCompleted}/${data.consistency.weeklyTarget}`}
              label="This Week"
              size="sm"
            />
          </div>
        </section>

        {data.calories ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Calories</h2>
            <p className="text-xs text-muted-foreground">Last 100 days</p>
            <div className="tile grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3">
              <StatDisplay
                value={String(data.calories.averagePerDay)}
                label="Avg / Day"
                sublabel={`across ${data.calories.loggedDays} logged day${data.calories.loggedDays === 1 ? "" : "s"}`}
                size="sm"
              />
              <StatDisplay
                value={
                  data.calories.daysWithinTarget != null
                    ? `${data.calories.daysWithinTarget}/${data.calories.loggedDays}`
                    : "—"
                }
                label="Within Goal"
                sublabel={data.calories.dailyTarget != null ? `${data.calories.dailyTarget} kcal goal` : "no goal set"}
                size="sm"
              />
              <StatDisplay
                value={String(data.calories.totalBurned)}
                label="Burned"
                sublabel="estimated from workouts"
                size="sm"
              />
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Workout Balance</h2>
          <p className="text-xs text-muted-foreground">Last 100 days</p>
          <WorkoutBalanceChart data={data.workoutBalance} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Body Weight</h2>
          <p className="text-xs text-muted-foreground">Last 100 days</p>
          <BodyWeightChart data={data.bodyWeight} />
        </section>

        {data.personalRecords.strength.length > 0 || data.personalRecords.cardio.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Personal Records</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.personalRecords.strength.map((pr) => (
                <div key={pr.name} className="tile rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{pr.name}</p>
                  <p className="text-sm font-semibold text-foreground">{pr.best} lb</p>
                </div>
              ))}
              {data.personalRecords.cardio.map((pr) => (
                <div key={pr.name} className="tile rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{pr.name}</p>
                  <p className="text-sm font-semibold text-foreground">{pr.best} mi</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {data.milestones.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
            <div className="flex flex-col gap-2">
              {data.milestones.map((m) => (
                <div key={m.id} className="tile flex items-start gap-3 rounded-xl border p-3">
                  <span className="text-lg leading-none">{ACHIEVEMENT_ICON[m.type] ?? "⭐"}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{format(m.achievedAt, "MMM d, yyyy")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
