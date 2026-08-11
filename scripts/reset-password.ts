/**
 * Admin password reset — the friend-scale substitute for a "forgot password"
 * email flow (the app has no email-sending infrastructure).
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <new-password>
 *
 * Whoever runs the database runs this, tells the person their new password,
 * and they change it after logging in (or keep it — friend scale).
 * Works against the local dev.db; for a deployed Turso database set
 * TURSO_DATABASE_URL/TURSO_AUTH_TOKEN first (this script has no production
 * gate — resetting a password is non-destructive — but double-check which
 * database the env points at before running).
 */
import path from "node:path";
import { betterAuth } from "better-auth";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildAuthOptions } from "../src/lib/auth-options";

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error("Usage: reset-password.ts <email> <new-password>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Passwords need at least 8 characters.");
    process.exit(1);
  }

  const adapter = process.env.TURSO_DATABASE_URL
    ? new PrismaLibSql({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
    : new PrismaBetterSqlite3({ url: path.join(process.cwd(), "prisma", "dev.db") });
  const prisma = new PrismaClient({ adapter });
  // Say out loud which database this touches — the env decides, and a shell
  // with Turso vars set would otherwise silently reset a deployed password.
  console.log(
    process.env.TURSO_DATABASE_URL
      ? `Target database: REMOTE ${process.env.TURSO_DATABASE_URL}`
      : `Target database: local ${path.join(process.cwd(), "prisma", "dev.db")}`
  );

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }
  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!credential) {
    console.error(`${email} has no password credential (was this account ever signed up?).`);
    process.exit(1);
  }

  // Same instance configuration as the app, so the hash format matches
  // exactly what sign-in verifies against.
  const auth = betterAuth(buildAuthOptions(prisma));
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  await ctx.internalAdapter.updatePassword(user.id, hash);

  // Sign out everywhere: a reset usually means the old holder shouldn't keep
  // any live sessions.
  const revoked = await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Password updated for ${email}. Revoked ${revoked.count} active session(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
