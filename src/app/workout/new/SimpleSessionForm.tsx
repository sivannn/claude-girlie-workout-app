"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { parseNumberInput } from "./sessionState";
import type { SimpleSessionData } from "./types";

export function SimpleSessionForm({
  session,
  backdated = false,
  onFinish,
  finishing,
}: {
  session: SimpleSessionData;
  /** Logging a previous session: duration is asked for instead of timed. */
  backdated?: boolean;
  onFinish: (result: { notes: string | null; durationMinutes: number | null }) => void;
  finishing: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <CategoryBadge colorKey={session.colorKey} label={session.workoutTypeName} />
      <p className="text-sm text-muted-foreground">
        No recommendation needed for {session.workoutTypeName} — just log it when you&apos;re done.
      </p>

      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go?"
          rows={4}
        />
      </div>

      {backdated ? (
        <div className="space-y-1.5">
          <Label>How long was it? (minutes)</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 45"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={finishing}
          onClick={() => router.push(backdated ? "/calendar" : "/")}
        >
          Exit
        </Button>
        <Button
          size="lg"
          className="flex-[2]"
          disabled={finishing || (backdated && !((parseNumberInput(duration) ?? 0) > 0))}
          onClick={() =>
            onFinish({
              notes: notes.trim() || null,
              durationMinutes: backdated ? parseNumberInput(duration) : null,
            })
          }
        >
          {finishing ? "Saving…" : backdated ? "Log Workout" : "Finish Workout"}
        </Button>
      </div>
    </div>
  );
}
