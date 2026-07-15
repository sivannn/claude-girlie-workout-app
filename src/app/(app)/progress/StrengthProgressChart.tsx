"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";

const LINE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function StrengthProgressChart({
  series,
}: {
  series: Array<{ name: string; points: Array<{ date: string; weight: number }> }>;
}) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Log a few more sessions to see strength trends here.
      </p>
    );
  }

  // Merge into a single dataset keyed by date for a shared X axis.
  const allDates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const data = allDates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of series) {
      const point = s.points.find((p) => p.date === date);
      if (point) row[s.name] = point.weight;
    }
    return row;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -16, right: 8 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => format(parseISO(d), "MMM d")}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              labelFormatter={(d) => format(parseISO(String(d)), "MMM d, yyyy")}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
            />
            {series.map((s, i) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
