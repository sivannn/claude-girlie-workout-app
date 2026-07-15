import { prisma } from "@/lib/prisma";

const DEFAULT_USER_EMAIL = "sivsivlevy@gmail.com";

/**
 * Single-user placeholder for real auth. Every Server Component/Action calls
 * this instead of reading a session, so swapping in real multi-user auth
 * later is a one-function change — the rest of the app already scopes every
 * query by userId.
 */
export async function getCurrentUser() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: DEFAULT_USER_EMAIL },
    include: { preferences: true },
  });
  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
