"use client";

import { useState } from "react";
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

/** Google's four-color "G", inlined because lucide ships no brand marks. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.26-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      // Redirects the whole page to Google; on success the callback lands on
      // "/" and the (app) layout's onboarding gate routes fresh accounts to
      // the questionnaire, same as email signups.
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) {
        setError(result.error.message || "Couldn't start Google sign-in. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setGoogleLoading(false);
    }
  }

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
            page background (no card), so the red mark would disappear. The
            mark is masked from the one transparent logo asset and painted in
            the Powder Petal foreground color — see .steam-mark in globals.css. */}
        <span role="img" aria-label="Steam" className="steam-mark h-12 w-12 text-foreground" />
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-accent-text underline underline-offset-4"
              >
                Forgot password?
              </Link>
            )}
          </div>
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

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="gap-2"
      >
        <GoogleMark />
        {googleLoading ? "One sec…" : "Continue with Google"}
      </Button>

      <p className="text-sm text-muted-foreground">
        {copy.switchPrompt}{" "}
        <Link href={copy.switchHref} className="font-medium text-accent-text underline underline-offset-4">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
