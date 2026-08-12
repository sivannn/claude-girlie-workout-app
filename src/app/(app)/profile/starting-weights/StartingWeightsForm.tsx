"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveStartingWeights } from "./actions";

export type StartingWeightRow = {
  exerciseId: string;
  name: string;
  categoryLabel: string;
  current: number | null;
  hasHistory: boolean;
};

export function StartingWeightsForm({ rows }: { rows: StartingWeightRow[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.exerciseId, r.current != null ? String(r.current) : ""]))
  );
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const grouped = rows.reduce<Record<string, StartingWeightRow[]>>((acc, row) => {
    (acc[row.categoryLabel] ??= []).push(row);
    return acc;
  }, {});

  function save() {
    setStatus("idle");
    startTransition(async () => {
      try {
        await saveStartingWeights(
          rows.map((r) => ({
            exerciseId: r.exerciseId,
            weightLb: values[r.exerciseId] ? Number(values[r.exerciseId]) : null,
          }))
        );
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(grouped).map(([category, group]) => (
        <section key={category} className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{category}</h2>
          <div className="flex flex-col gap-2">
            {group.map((row) => (
              <div
                key={row.exerciseId}
                className="tile flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  {row.hasHistory ? (
                    <p className="text-xs text-muted-foreground">
                      Already learned from your logged sessions
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={1500}
                    step={5}
                    className="h-9 w-24"
                    placeholder="—"
                    disabled={row.hasHistory}
                    value={values[row.exerciseId] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [row.exerciseId]: e.target.value }))
                    }
                    aria-label={`Working weight for ${row.name}`}
                  />
                  <span className="text-xs text-muted-foreground">lb</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save weights"}
        </Button>
        {status === "saved" ? (
          <p className="text-sm font-medium text-accent-text" role="status">
            Saved — Alex will start from these.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Couldn&apos;t save. Please try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
