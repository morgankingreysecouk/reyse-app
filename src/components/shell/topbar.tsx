"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface flex items-center justify-end gap-4 px-6">
      {session?.user?.email && (
        <div className="flex items-center gap-3">
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
