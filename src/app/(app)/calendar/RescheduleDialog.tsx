"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { rescheduleEvent } from "./actions";

export function RescheduleDialog({
  eventId,
  workoutTypeName,
  status,
}: {
  eventId: string;
  workoutTypeName: string;
  status: "PLANNED" | "MISSED";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const confirm = async () => {
    setSaving(true);
    setError(false);
    try {
      await rescheduleEvent(eventId, date, today);
    } catch {
      setError(true);
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening should start clean, not show the last attempt's error.
        if (next) {
          setError(false);
          setDate(today);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1">
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule {workoutTypeName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {status === "MISSED"
            ? "You missed this planned workout. Pick a new day for it."
            : "Pick the day this workout should move to."}
        </p>
        <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        {error ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Couldn&apos;t reschedule — pick today or a future day and try again.
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={saving} onClick={confirm}>
            {saving ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
