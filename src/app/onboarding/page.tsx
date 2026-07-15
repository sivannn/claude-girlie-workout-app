import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OnboardingWizard } from "./OnboardingWizard";

// Reads live onboarding status from the database — must never be served as
// build-time-frozen static HTML (see (app)/layout.tsx for the same fix).
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user.preferences?.onboardingCompletedAt) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <OnboardingWizard />
    </div>
  );
}
