"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The server answers identically whether or not the email is
      // registered, so the confirmation below is the same either way — this
      // page must never reveal which addresses have accounts.
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error) {
        // Rate limit or server trouble — not an "email not found" signal
        // (the endpoint never says that).
        setError("Couldn't send the email just now. Wait a moment and try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        <span role="img" aria-label="Steam" className="steam-mark h-12 w-12 text-foreground" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter your account email and we&apos;ll send you a link to set a new password.
          </p>
        </div>
      </div>

      {submitted ? (
        <div className="space-y-4">
          <p className="rounded-md bg-secondary px-3 py-3 text-sm leading-relaxed text-foreground" role="status">
            If that email has a Steam account, a reset link is on its way. The link works once and
            expires in an hour — check your spam folder if it doesn&apos;t show up.
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-accent-text underline underline-offset-4">
              Back to login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {error && (
            <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-foreground" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "One sec…" : "Email me a reset link"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-accent-text underline underline-offset-4">
              Log in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
