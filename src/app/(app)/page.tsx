import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ProgressBarLabeled } from "@/components/shared/ProgressBarLabeled";
import { StatDisplay } from "@/components/shared/StatDisplay";
import {
  WEEKLY_GOAL_BUCKETS,
  completedWeeklyGoalCount,
  totalWeeklyGoalCount,
} from "@/lib/engine";
import type { WeeklyGoalBucket } from "@/lib/data/workout-types";
import { getHomeData } from "./home-data";

const BUCKET_LABEL: Record<WeeklyGoalBucket, string> = {
  leg_day: "Leg Day",
  upper_body: "Upper Body",
  cardio: "Cardio",
  fun: "Fun Activity",
};

const ACHIEVEMENT_ICON: Record<string, string> = {
  PR: "🏆",
  GOAL_COMPLETED: "🎯",
  STREAK: "🔥",
  MILESTONE_COUNT: "✨",
  OTHER: "⭐",
};

export default async function HomePage() {
  const data = await getHomeData();
  const weeklyCompleted = completedWeeklyGoalCount(data.weeklyStatus);
  const weeklyTotal = totalWeeklyGoalCount({
    legDay: data.weeklyStatus.leg_day.target,
    upperBody: data.weeklyStatus.upper_body.target,
    cardio: data.weeklyStatus.cardio.target,
    fun: data.weeklyStatus.fun.target,
  });

  return (
    <div className="flex flex-col gap-8">
      {data.draftWorkout ? (
        <Button size="lg" variant="outline" className="w-full text-base" asChild>
          <Link href={`/workout/new?resume=${data.draftWorkout.id}`}>
            Resume {data.draftWorkout.workoutTypeName}
          </Link>
        </Button>
      ) : null}

      <Button size="lg" className="w-full text-base" asChild>
        <Link
          href={data.recommendation ? `/workout/new?type=${data.recommendation.workoutType.id}` : "/workout/new"}
        >
          Start Workout
        </Link>
      </Button>

      {data.recommendation ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <CategoryBadge
              colorKey={data.recommendation.workoutType.colorKey}
              label={data.recommendation.workoutType.name}
            />
            <span className="text-sm text-muted-foreground">
              Estimated time: {data.recommendation.estimatedDurationMinutes} min
            </span>
          </div>
          <AlexNote title="Why this workout?">
            {data.recommendationReason ?? data.recommendation.reason}
          </AlexNote>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Weekly Goals</h2>
        <div className="flex flex-col gap-2">
          {WEEKLY_GOAL_BUCKETS.map((bucket) => {
            const status = data.weeklyStatus[bucket];
            const isRecommended = data.recommendedBucket === bucket && !status.completed;
            return (
              <div
                key={bucket}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  status.completed ? "tile-dark" : "tile"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                      status.completed
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{BUCKET_LABEL[bucket]}</p>
                    <p className="text-xs text-muted-foreground">
                      {status.completed && status.completedDate
                        ? `Completed ${format(status.completedDate, "MMM d")}`
                        : status.lastCompletedDate
                          ? `Last completed ${format(status.lastCompletedDate, "MMM d")}`
                          : "Not completed yet"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isRecommended ? (
                    <span className="rounded-full bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent">
                      Recommended
                    </span>
                  ) : null}
                  {!status.completed ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={data.bucketStartHref[bucket]}>Start</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <ProgressBarLabeled
          label="Weekly Goal"
          current={weeklyCompleted}
          total={weeklyTotal}
          formatValue={`${weeklyCompleted} / ${weeklyTotal} workouts completed`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Monthly Goal</h2>
        <ProgressBarLabeled
          label="Consistency"
          current={data.monthlyStatus.completedCount}
          total={data.monthlyStatus.target}
          formatValue={`${data.monthlyStatus.completedCount} / ${data.monthlyStatus.target} workouts completed`}
        />
      </section>

      <section className="tile grid grid-cols-2 gap-4 rounded-xl border p-4">
        <StatDisplay
          value={`${data.streakStatus.currentStreak}`}
          label="Current Streak"
          sublabel={`${data.streakStatus.currentStreak} consecutive week${data.streakStatus.currentStreak === 1 ? "" : "s"}`}
          size="lg"
        />
        <StatDisplay
          value={`${data.streakStatus.longestStreak}`}
          label="Longest Streak"
          sublabel={`${data.streakStatus.longestStreak} week${data.streakStatus.longestStreak === 1 ? "" : "s"}`}
          size="lg"
        />
      </section>

      {data.recentAchievements.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Wins</h2>
          <div className="flex flex-col gap-2">
            {data.recentAchievements.map((a) => (
              <div key={a.id} className="tile flex items-start gap-3 rounded-xl border p-3">
                <span className="text-lg leading-none">{ACHIEVEMENT_ICON[a.type] ?? "⭐"}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{format(a.achievedAt, "MMM d")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.insightText ? <AlexNote title="Coach's Insight">{data.insightText}</AlexNote> : null}

      {/* Temporary until the Phase 2 Profile page exists. */}
      <div className="flex justify-center pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
