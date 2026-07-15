"use client";

import { format, parseISO } from "date-fns";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BodyWeightChart({ data }: { data: Array<{ date: string; weight: number }> }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Log your body weight to see this trend.</p>;
  }

  return (
    <div className="h-48 w-full">
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
          <YAxis
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            labelFormatter={(d) => format(parseISO(String(d)), "MMM d, yyyy")}
            formatter={(value) => [`${value} lb`, "Weight"]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
          />
          <Line type="monotone" dataKey="weight" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
