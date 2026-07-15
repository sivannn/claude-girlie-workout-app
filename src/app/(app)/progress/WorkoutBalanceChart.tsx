"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryColorVar, categoryLabel } from "@/lib/design/categories";

export function WorkoutBalanceChart({ data }: { data: Array<{ colorKey: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No workouts logged in the last 100 days yet.</p>;
  }

  const chartData = data
    .map((d) => ({ label: categoryLabel(d.colorKey), colorKey: d.colorKey, count: d.count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
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
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {chartData.map((d) => (
              <Cell key={d.colorKey} fill={categoryColorVar(d.colorKey)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
