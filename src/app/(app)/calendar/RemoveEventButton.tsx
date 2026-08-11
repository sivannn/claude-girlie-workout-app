"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { removeCompletedWorkout, removePlannedEvent } from "./actions";

/**
 * Removal for both kinds of calendar entries. Completed workouts get the
 * heavier confirmation copy since deleting one erases logged sets and syncs
 * PRs/goals app-wide (hard delete — there is no undo).
 */
export function RemoveEventButton({
  eventId,
  workoutId,
  workoutTypeName,
  completed,
}: {
  eventId: string;
  workoutId: string | null;
  workoutTypeName: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(false);

  async function confirm() {
    setRemoving(true);
    setError(false);
    try {
      if (completed && workoutId) {
        await removeCompletedWorkout(workoutId);
      } else {
        await removePlannedEvent(eventId);
      }
    } catch {
      setError(true);
      setRemoving(false);
      return;
    }
    setRemoving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive">
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {workoutTypeName}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {completed
            ? "This permanently deletes the workout and everything you logged in it. Your stats, records, and goal progress will update as if it never happened. This can't be undone."
            : "This removes the planned workout from your calendar. You can always schedule it again."}
        </p>
        {error ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Couldn&apos;t remove it. Please try again.
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={removing}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={removing}>
            {removing ? "Removing…" : completed ? "Delete workout" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
