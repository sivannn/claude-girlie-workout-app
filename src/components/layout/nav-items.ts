import { CalendarDays, Home, LineChart, ListChecks, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/history", label: "History", icon: ListChecks },
  { href: "/progress", label: "Progress", icon: LineChart },
];
