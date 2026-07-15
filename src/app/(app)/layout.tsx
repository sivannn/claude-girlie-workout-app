import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user.preferences?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
