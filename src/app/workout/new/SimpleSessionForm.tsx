"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import type { SimpleSessionData } from "./types";

export function SimpleSessionForm({
  session,
  onFinish,
  finishing,
}: {
  session: SimpleSessionData;
  onFinish: (result: { notes: string | null }) => void;
  finishing: boolean;
}) {
  const [notes, setNotes] = useState("");

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

      <Button size="lg" disabled={finishing} onClick={() => onFinish({ notes: notes.trim() || null })}>
        {finishing ? "Saving…" : "Finish Workout"}
      </Button>
    </div>
  );
}
