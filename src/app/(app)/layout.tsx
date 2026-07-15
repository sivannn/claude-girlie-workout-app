import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";

// Every page here reads live data straight from the database (not via
// fetch()), which Next.js's static-optimization detection doesn't see as a
// dynamic signal on its own — without this, these routes would be
// prerendered once at build time and served as frozen HTML in production.
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user.preferences?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
