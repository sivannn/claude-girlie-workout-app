"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlexNote } from "@/components/shared/AlexNote";
import { Badge } from "@/components/ui/badge";

export function RecapScreen({
  workoutTypeName,
  recap,
  prsAchieved,
  loggedForLabel = null,
}: {
  workoutTypeName: string;
  recap: string;
  prsAchieved: string[];
  /** Set for backdated logs — names the day the workout was recorded for. */
  loggedForLabel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {loggedForLabel ? "Workout logged" : "Workout complete"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {loggedForLabel
            ? `${workoutTypeName} logged for ${loggedForLabel}. Nice work.`
            : `${workoutTypeName} logged. Nice work.`}
        </p>
      </div>

      {prsAchieved.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {prsAchieved.map((pr) => (
            <Badge key={pr} className="bg-accent text-accent-foreground">
              🏆 {pr}
            </Badge>
          ))}
        </div>
      ) : null}

      <AlexNote title="Recap">{recap}</AlexNote>

      <Button size="lg" asChild>
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}
