import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";

export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="Home"
        subtitle="Dashboard coming in Phase 4 — foundation is live."
      />
      <Button size="lg" className="w-full text-base">
        Start Workout
      </Button>
    </div>
  );
}
