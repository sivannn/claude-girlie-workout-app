"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemActive, type NavItem } from "./nav-items";

function NavTab({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
        isActive ? "text-accent-text" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
      {item.label}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-sidebar/80 md:hidden">
      {left.map((item) => (
        <NavTab key={item.href} item={item} pathname={pathname} />
      ))}
      <Link
        href="/workout/new"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
        aria-label="Start Workout"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </Link>
      {right.map((item) => (
        <NavTab key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
