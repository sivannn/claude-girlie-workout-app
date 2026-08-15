import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

// Landing page for the emailed link: Better Auth's GET /reset-password/:token
// validates the token and redirects here with ?token=… on success or
// ?error=INVALID_TOKEN when it's expired or already used.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <ResetPasswordForm token={token ?? null} linkInvalid={Boolean(error) || !token} />
    </div>
  );
}
