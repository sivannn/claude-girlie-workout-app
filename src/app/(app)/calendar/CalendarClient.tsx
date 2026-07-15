"use client";

import { useRouter } from "next/navigation";
import { addMonths, endOfWeek, format, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlexNote } from "@/components/shared/AlexNote";
import { MonthGrid } from "./MonthGrid";
import { WeekView } from "./WeekView";
import { MonthlySummaryChart } from "./MonthlySummaryChart";
import type { CalendarEvent, MonthlySummary } from "./data";
import type { WeeklyGoalBucket } from "@/lib/data/workout-types";

type WeeklyStatus = Record<
  WeeklyGoalBucket,
  { completed: boolean; completedDate: Date | null; lastCompletedDate: Date | null }
>;

export function CalendarClient({
  monthDate,
  gridStart,
  gridEnd,
  events,
  weekEvents,
  recommendedWorkoutTypeId,
  recommendationReason,
  weeklyStatus,
  monthlySummary,
}: {
  monthDate: Date;
  gridStart: Date;
  gridEnd: Date;
  events: CalendarEvent[];
  weekEvents: CalendarEvent[];
  recommendedWorkoutTypeId: string | null;
  recommendationReason: string | null;
  weeklyStatus: WeeklyStatus;
  monthlySummary: MonthlySummary;
}) {
  const router = useRouter();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const goToMonth = (date: Date) => {
    router.push(`/calendar?month=${format(date, "yyyy-MM")}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {recommendationReason ? <AlexNote title="Coach's Pick">{recommendationReason}</AlexNote> : null}

      <Tabs defaultValue="monthly">
        <TabsList className="w-full">
          <TabsTrigger value="monthly" className="flex-1">
            Monthly
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="flex flex-col gap-6 pt-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => goToMonth(subMonths(monthDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">{format(monthDate, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={() => goToMonth(addMonths(monthDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <MonthGrid
            gridStart={gridStart}
            gridEnd={gridEnd}
            events={events}
            monthDate={monthDate}
            recommendedWorkoutTypeId={recommendedWorkoutTypeId}
          />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Monthly Summary</h2>
            <MonthlySummaryChart summary={monthlySummary} />
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="pt-4">
          <WeekView weekStart={weekStart} weekEnd={weekEnd} events={weekEvents} weeklyStatus={weeklyStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
