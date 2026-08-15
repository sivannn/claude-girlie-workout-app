// Outbound email, kept to one tiny module so the provider can be swapped by
// rewriting a single function. Currently Resend's REST API over fetch — no
// SDK dependency. Deliberately NOT "server-only": buildAuthOptions pulls this
// in, and admin scripts under scripts/ import that outside a React server
// context.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's shared onboarding sender (no custom domain yet). Free-tier caveat:
// it only delivers to the address that owns the Resend account, which is fine
// while Steam is single-user. A verified domain lifts that.
const FROM = "Steam <onboarding@resend.dev>";

/** Plain-text email: no HTML means no tracking pixels, by construction. */
export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set — cannot send email");
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: params.to, subject: params.subject, text: params.text }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const firstName = params.name.trim().split(/\s+/)[0] || "there";
  await sendEmail({
    to: params.to,
    subject: "Reset your Steam password",
    text: [
      `Hi ${firstName},`,
      "",
      "Someone asked to reset the password for the Steam account under this email address. If that was you, open this link to choose a new password:",
      "",
      params.resetUrl,
      "",
      "The link works once and expires in an hour. If you didn't ask for this, you can ignore this email — your password hasn't changed.",
      "",
      "— Steam",
    ].join("\n"),
  });
}
