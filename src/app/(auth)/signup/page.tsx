import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <AuthForm mode="signup" />
    </div>
  );
}
