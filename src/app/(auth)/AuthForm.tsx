"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  { title: string; subtitle: string; cta: string; switchPrompt: string; switchLabel: string; switchHref: string }
> = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to pick up where you left off.",
    cta: "Log in",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    subtitle: "A couple of details, then Alex takes it from there.",
    cta: "Create account",
    switchPrompt: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
  },
};

function friendlyError(mode: Mode, message: string | undefined): string {
  const lower = (message ?? "").toLowerCase();
  if (mode === "login" && (lower.includes("invalid") || lower.includes("not found"))) {
    return "That email and password don't match. Try again?";
  }
  if (mode === "signup" && lower.includes("already exists")) {
    return "There's already an account with this email — try logging in instead.";
  }
  if (lower.includes("password") && lower.includes("short")) {
    return "Passwords need at least 8 characters.";
  }
  return message || "Something went wrong. Please try again.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(friendlyError(mode, result.error.message));
        setSubmitting(false);
        return;
      }
    } catch {
      // fetch itself rejected (offline, server down) — never leave the
      // button stuck in its disabled "One sec…" state.
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
      return;
    }
    // New accounts land on the intro questionnaire via the (app) layout's
    // onboarding gate; returning users go straight to their dashboard.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        {/* Light logo: the auth screen sits directly on the dark Black Cherry
            page background (no card), so the red mark would disappear. */}
        <Image src="/steam-logo-light.png" alt="Steam" width={48} height={48} className="rounded-full" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="What should Alex call you?"
              required
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-foreground" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "One sec…" : copy.cta}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {copy.switchPrompt}{" "}
        <Link href={copy.switchHref} className="font-medium text-accent-text underline underline-offset-4">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
