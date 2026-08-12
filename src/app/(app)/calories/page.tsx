import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCaloriesPageData } from "./data";
import { MealLogger } from "./MealLogger";

export const dynamic = "force-dynamic";

export default async function CaloriesPage() {
  const data = await getCaloriesPageData();
  const { status } = data;
  const overBudget = status != null && status.remaining < 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calories"
        subtitle="Snap a photo of a meal and Alex will log it for you."
      />

      {status ? (
        <section className="tile space-y-3 rounded-xl border p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {overBudget ? "Over budget" : "Remaining today"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status.consumed} eaten
              {status.burned > 0 ? ` · ${status.burned} burned` : ""} · {status.target} goal
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {Math.abs(status.remaining)}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              kcal {overBudget ? "over" : "left"}
            </span>
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={Math.min(100, status.percentUsed)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Calories used today"
          >
            <div
              className={overBudget ? "h-full bg-destructive" : "h-full bg-primary"}
              style={{ width: `${Math.min(100, Math.max(2, status.percentUsed))}%` }}
            />
          </div>
          {status.burned > 0 ? (
            <p className="text-xs text-muted-foreground">
              Includes {status.burned} kcal from {data.burnedFrom.join(", ")}.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="tile space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium text-foreground">No daily goal set yet</p>
          <p className="text-sm text-muted-foreground">
            Set one in{" "}
            <Link href="/goals" className="font-medium text-accent-text underline underline-offset-4">
              Goals
            </Link>{" "}
            and this turns into a running total of what you have left for the day.
          </p>
          {data.consumed > 0 ? (
            <p className="text-sm text-foreground">
              You&apos;ve logged{" "}
              <span className="font-semibold tabular-nums">{data.consumed} kcal</span> today.
            </p>
          ) : null}
        </section>
      )}

      <MealLogger meals={data.meals} />
    </div>
  );
}
