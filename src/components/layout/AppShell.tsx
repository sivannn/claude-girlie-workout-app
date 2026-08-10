import type { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
