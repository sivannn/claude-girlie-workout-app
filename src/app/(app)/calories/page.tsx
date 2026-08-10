import { UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export const dynamic = "force-dynamic";

// Shell only for now: the meal-photo logging feature arrives in a later
// phase — the tab ships early so the navigation lands in its final shape once.
export default function CaloriesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Calories"
        subtitle="Snap a photo of a meal and Alex will log it for you."
      />
      <div className="tile flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
        <UtensilsCrossed className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">Coming soon</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Meal photo logging, daily calorie goals, and calories burned per workout are on the
          way in an upcoming update.
        </p>
      </div>
    </div>
  );
}
