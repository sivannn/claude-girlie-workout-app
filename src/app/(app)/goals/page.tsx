import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { AddGoalDialog } from "./AddGoalDialog";
import { ExerciseGoalCard } from "./ExerciseGoalCard";
import { GoalSuggestionCard } from "./GoalSuggestionCard";
import { getGoalsPageData } from "./actions";

export default async function GoalsPage() {
  const data = await getGoalsPageData();

  return (
    <div>
      <PageHeader
        title="Goals & Milestones"
        subtitle="Where you started, where you are, and where you're headed."
      />

      <div className="flex flex-col gap-6">
        {data.suggestions.map((s) => (
          <GoalSuggestionCard key={s.completedGoalId} suggestion={s} />
        ))}

        <AddGoalDialog />

        <Accordion type="single" collapsible className="flex flex-col gap-3">
          {data.categories.map((cat) => (
            <AccordionItem
              key={cat.category}
              value={cat.category}
              className="rounded-xl border border-border px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full flex-col gap-2 pr-2 text-left">
                  <span className="font-semibold text-foreground">{cat.name}</span>
                  {cat.activeGoalCount > 0 ? (
                    <>
                      <div className="flex items-center gap-3">
                        <Progress value={cat.overallProgress} className="h-1.5 flex-1" />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {cat.overallProgress}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {cat.activeGoalCount} Active Goal{cat.activeGoalCount === 1 ? "" : "s"}
                        </span>
                        {cat.nextProjectedGoal ? (
                          <span>Next up: {cat.nextProjectedGoal}</span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No active goals yet</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <p className="text-sm text-muted-foreground">{cat.description}</p>
                {cat.goals.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {cat.goals.map((goal) => (
                      <ExerciseGoalCard key={goal.id} goal={goal} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add a goal for this category to start tracking progress.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {data.hallOfFame.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Hall of Fame</h2>
            <div className="flex flex-col gap-2">
              {data.hallOfFame.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {g.title} — {g.targetValue} {g.unit}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.completedAt ? format(g.completedAt, "MMM d, yyyy") : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
