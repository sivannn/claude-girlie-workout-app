"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is the heaviest chunk this page ships. Loading the charts after
// hydration keeps the initial bundle small; the skeletons match each chart's
// rendered height so nothing jumps when they pop in.
export const StrengthProgressChart = dynamic(
  () => import("./StrengthProgressChart").then((m) => m.StrengthProgressChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

export const BodyWeightChart = dynamic(
  () => import("./BodyWeightChart").then((m) => m.BodyWeightChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);

export const WorkoutBalanceChart = dynamic(
  () => import("./WorkoutBalanceChart").then((m) => m.WorkoutBalanceChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> }
);
