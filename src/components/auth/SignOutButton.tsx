"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Temporary home for sign-out until Phase 2's Profile page exists — small and
// muted on purpose, at the bottom of the Home page.
export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } catch {
      setSigningOut(false);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
