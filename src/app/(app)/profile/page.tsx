import Link from "next/link";
import { ChevronRight, LineChart, Settings, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HUB_LINKS: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> = [
  { href: "/goals", label: "Goals", hint: "Milestones and targets you're working toward", icon: Target },
  { href: "/progress", label: "Progress", hint: "Strength trends, consistency, and body weight", icon: LineChart },
  {
    href: "/profile/settings",
    label: "Account Settings",
    hint: "Your answers from the intro questionnaire",
    icon: Settings,
  },
];

export default async function ProfilePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" />

      <div className="tile flex items-center gap-4 rounded-xl border p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-alex text-lg font-semibold text-alex-foreground">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {HUB_LINKS.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="tile flex items-center gap-3.5 rounded-xl border p-4 transition-colors hover:bg-secondary/60"
          >
            <Icon className="h-5 w-5 shrink-0 text-accent-text" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>

      <div className="flex justify-center pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
