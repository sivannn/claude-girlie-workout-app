import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Milestone = { id: string; value: number; achievedAt: Date | null };

export function ExerciseGoalCard({
  goal,
}: {
  goal: {
    id: string;
    title: string;
    unit: string;
    startingValue: number;
    currentBest: number;
    targetValue: number;
    priority: string;
    milestones: Milestone[];
    forecast: { estimatedWeeks: number; estimatedMonths: number } | null;
  };
}) {
  const range = goal.targetValue - goal.startingValue;
  const progressed = goal.currentBest - goal.startingValue;
  const pct = range > 0 ? Math.min(100, Math.max(0, Math.round((progressed / range) * 100))) : 100;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground">{goal.title}</h3>
        <Badge variant="outline" className="text-[11px] font-normal">
          {goal.priority === "HIGH" ? "High Priority" : goal.priority === "LOW" ? "Low Priority" : "Medium Priority"}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Started</p>
          <p className="text-sm font-medium text-foreground">
            {goal.startingValue} {goal.unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Current Best</p>
          <p className="text-sm font-medium text-foreground">
            {goal.currentBest} {goal.unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Goal</p>
          <p className="text-sm font-medium text-foreground">
            {goal.targetValue} {goal.unit}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">
          {Math.max(0, progressed)} / {range} {goal.unit} · {pct}%
        </p>
      </div>

      {goal.milestones.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {goal.milestones.map((m) => (
            <span
              key={m.id}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                m.achievedAt
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {m.achievedAt ? "✓ " : ""}
              {m.value} {goal.unit}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        {goal.forecast
          ? `At your current rate of progress, you're projected to reach this goal in approximately ${
              goal.forecast.estimatedMonths >= 1
                ? `${goal.forecast.estimatedMonths} month${goal.forecast.estimatedMonths === 1 ? "" : "s"}`
                : `${goal.forecast.estimatedWeeks} week${goal.forecast.estimatedWeeks === 1 ? "" : "s"}`
            }.`
          : "Not enough history yet to forecast a completion date."}
      </p>
    </div>
  );
}
