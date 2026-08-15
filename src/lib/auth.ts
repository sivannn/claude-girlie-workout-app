import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { provisionUserLibrary } from "@/lib/data/provisioning";
import { prisma } from "@/lib/prisma";

/**
 * The session for the current request, or null when signed out. Cached per
 * request so a layout, page, and actions sharing one render don't repeat the
 * session lookup.
 */
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/**
 * The signed-in user with preferences, for Server Components and Actions.
 * Redirects to /login when there is no session — every caller can keep
 * assuming a user exists, exactly as under the old single-user placeholder.
 *
 * Cached per request: a page's layout and data functions each call this, and
 * without the cache every call was its own database round-trip (the calendar
 * page re-fetched the same User row ten times per load).
 */
export const getCurrentUser = cache(async () => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }
  let user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: { preferences: true },
  });
  if (!user) {
    // A valid session for a since-deleted user: treat as signed out.
    redirect("/login");
  }
  if (!user.preferences) {
    // Signup's provisioning hook failed partway (it isn't transactional) —
    // the preferences row is written last as its completion marker, so
    // re-run the idempotent provisioning until it succeeds. Costs nothing
    // once the account is healthy.
    await provisionUserLibrary(prisma, user.id);
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { preferences: true },
    });
    if (!user) redirect("/login");
  }
  return user;
});
