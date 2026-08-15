"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token, linkInvalid }: { token: string | null; linkInvalid: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
      if (result.error) {
        const message = (result.error.message ?? "").toLowerCase();
        setError(
          message.includes("token")
            ? "This link has expired or was already used. Request a new one from the login page."
            : result.error.message || "Something went wrong. Please try again."
        );
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
          {!linkInvalid && !done && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set it and you&apos;ll be back to training in a minute.
            </p>
          )}
        </div>
      </div>

      {linkInvalid ? (
        <div className="space-y-4">
          <p className="rounded-md bg-destructive/15 px-3 py-3 text-sm leading-relaxed text-foreground" role="alert">
            This reset link has expired or was already used. Request a fresh one and try again —
            links only work once and last an hour.
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/forgot-password" className="font-medium text-accent-text underline underline-offset-4">
              Request a new link
            </Link>
          </p>
        </div>
      ) : done ? (
        <p className="rounded-md bg-secondary px-3 py-3 text-sm leading-relaxed text-foreground" role="status">
          Password updated — taking you to the login page…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Repeat it</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-foreground" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "One sec…" : "Set new password"}
          </Button>
        </form>
      )}
    </div>
  );
}
