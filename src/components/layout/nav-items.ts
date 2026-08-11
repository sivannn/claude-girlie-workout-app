import { CalendarDays, Home, UserRound, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// The bottom bar renders these split around the centered red Start Workout
// plus: [0..1] · plus · [2..3]. Goals and Progress moved under Profile.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/calories", label: "Calories", icon: UtensilsCrossed },
  { href: "/profile", label: "Profile", icon: UserRound },
];

/** Pages that live under the Profile hub keep the Profile tab highlighted. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.href === "/profile") {
    return (
      pathname.startsWith("/profile") ||
      pathname.startsWith("/goals") ||
      pathname.startsWith("/progress")
    );
  }
  return pathname.startsWith(item.href);
}
