import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { buildAuthOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  ...buildAuthOptions(prisma),
  // Must stay last so cookies set inside server actions reach the response.
  plugins: [nextCookies()],
});
