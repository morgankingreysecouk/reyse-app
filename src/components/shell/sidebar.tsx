"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "./logo";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border text-indigo">
        <Logo />
        <div className="leading-tight">
          <div className="font-display font-bold text-ink text-sm tracking-wide">
            REYSE
          </div>
          <div className="text-[11px] text-ink-muted -mt-0.5">Admin</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo/10 text-indigo"
                  : "text-ink-muted hover:text-ink hover:bg-surface-raised"
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-xs text-ink-muted">
          Foundation build — most sections are placeholders while the real
          workflows get rebuilt one at a time.
        </div>
      </div>
    </aside>
  );
}
