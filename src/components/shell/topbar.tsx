"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { data: session } = useSession();

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface flex items-center gap-4 px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="text-ink-muted hover:text-ink transition-colors lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      {session?.user?.email && (
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right leading-tight">
            <div className="text-sm text-ink font-medium">
              {session.user.name ?? "Morgan King"}
            </div>
            <div className="text-xs text-ink-muted">{session.user.email}</div>
          </div>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-8 w-8 rounded-full border border-border-strong"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-indigo/20 text-indigo flex items-center justify-center text-xs font-semibold">
              MK
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-ink-muted hover:text-ink transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      )}
    </header>
  );
}
