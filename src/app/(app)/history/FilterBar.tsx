"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORY_OPTIONS = [
  { value: "WEIGHTLIFTING", label: "Strength" },
  { value: "CARDIO", label: "Cardio" },
  { value: "FUN", label: "Fun" },
  { value: "RECOVERY", label: "Recovery" },
];

export function FilterBar({
  workoutTypes,
}: {
  workoutTypes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/history?${params.toString()}`);
  };

  const prOnly = searchParams.get("prOnly") === "true";
  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("workoutTypeId") ?? "all"} onValueChange={(v) => setParam("workoutTypeId", v)}>
        <SelectTrigger className="w-auto min-w-[9rem]">
          <SelectValue placeholder="Workout type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {workoutTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("category") ?? "all"} onValueChange={(v) => setParam("category", v)}>
        <SelectTrigger className="w-auto min-w-[8rem]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORY_OPTIONS.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={prOnly ? "default" : "outline"}
        size="sm"
        onClick={() => setParam("prOnly", prOnly ? null : "true")}
      >
        PRs only
      </Button>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => setParam("dateFrom", e.target.value || null)}
          className="h-9 w-[9.5rem]"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => setParam("dateTo", e.target.value || null)}
          className="h-9 w-[9.5rem]"
          aria-label="To date"
        />
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.push("/history")}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
