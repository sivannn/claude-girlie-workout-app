import { createAuthClient } from "better-auth/react";

// Browser-side auth client. Same-origin /api/auth by default, so cookies are
// set by the server's Set-Cookie response — the combination that persists in
// iOS home-screen PWA storage.
export const authClient = createAuthClient();
