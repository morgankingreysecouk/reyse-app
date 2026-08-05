"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "./logo";
import { cn } from "@/lib/cn";

// Static and always visible at lg+ (the original behaviour). Below that, it's
// a fixed slide-in drawer controlled by AdminShell's mobileNavOpen state --
// the whole admin shell had no mobile treatment at all before this (checked:
// every other admin page had the exact same squeeze, not just this one).
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-border bg-surface flex flex-col transition-transform duration-200",
          "lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-border text-indigo">
          <div className="flex items-center gap-2">
            <Logo />
            <div className="leading-tight">
              <div className="font-display font-bold text-ink text-sm tracking-wide">
                REYSE
              </div>
              <div className="text-[11px] text-ink-muted -mt-0.5">Admin</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
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
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo/10 text-indigo"
                    : "text-ink-muted hover:text-ink hover:bg-surface-raised"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-indigo" />
                )}
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
