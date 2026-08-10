"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-sidebar md:px-4 md:py-6">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-alex-foreground p-1.5">
          <Image src="/steam-logo.png" alt="" width={20} height={20} className="h-full w-full object-contain" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          Steam
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        <Link
          href="/workout/new"
          className="mb-1 flex items-center gap-3 rounded-lg bg-destructive px-3 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          <Plus className="h-4.5 w-4.5" strokeWidth={2.5} />
          Start Workout
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
