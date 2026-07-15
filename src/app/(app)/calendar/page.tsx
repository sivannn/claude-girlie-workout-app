import { parse } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { CalendarClient } from "./CalendarClient";
import {
  getCalendarMonthData,
  getCurrentWeekEvents,
  getMonthlySummary,
  getWeeklyGoalChecklist,
} from "./data";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthDate = month ? parse(month, "yyyy-MM", new Date()) : new Date();

  const [monthData, weekEvents, weeklyStatus, monthlySummary] = await Promise.all([
    getCalendarMonthData(monthDate),
    getCurrentWeekEvents(),
    getWeeklyGoalChecklist(new Date()),
    getMonthlySummary(monthDate),
  ]);

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Your training story — planned, completed, and missed." />
      <CalendarClient
        monthDate={monthDate}
        gridStart={monthData.gridStart}
        gridEnd={monthData.gridEnd}
        events={monthData.events}
        weekEvents={weekEvents}
        recommendedWorkoutTypeId={monthData.recommendedWorkoutTypeId}
        recommendationReason={monthData.recommendationReason}
        weeklyStatus={weeklyStatus}
        monthlySummary={monthlySummary}
      />
    </div>
  );
}
