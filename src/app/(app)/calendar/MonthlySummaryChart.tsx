"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatDisplay } from "@/components/shared/StatDisplay";
import { CATEGORY_FAMILY_VAR, CATEGORY_FAMILY_LABEL } from "@/lib/design/categories";
import type { WorkoutCategory } from "@/lib/types/enums";
import type { MonthlySummary } from "./data";

const CATEGORY_ORDER: WorkoutCategory[] = ["WEIGHTLIFTING", "CARDIO", "FUN", "RECOVERY"];

export function MonthlySummaryChart({ summary }: { summary: MonthlySummary }) {
  const chartData = CATEGORY_ORDER.map((category) => {
    const found = summary.categoryBreakdown.find((c) => c.category === category);
    return { category, label: CATEGORY_FAMILY_LABEL[category], count: found?.count ?? 0 };
  }).filter((d) => d.count > 0);

  return (
    <div className="tile space-y-4 rounded-xl border p-4">
      <div className="grid grid-cols-3 gap-4">
        <StatDisplay value={String(summary.totalCompleted)} label="Total" size="sm" />
        <StatDisplay value={String(summary.averagePerWeek)} label="Avg / Week" size="sm" />
        <StatDisplay value={`${summary.completionRate}%`} label="Completion Rate" size="sm" />
      </div>

      {chartData.length > 0 ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={90}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--secondary)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {chartData.map((d) => (
                  <Cell key={d.category} fill={`var(${CATEGORY_FAMILY_VAR[d.category]})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No completed workouts this month yet.</p>
      )}
    </div>
  );
}
