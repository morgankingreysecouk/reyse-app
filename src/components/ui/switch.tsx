"use client";

import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// A real toggle switch instead of a raw browser checkbox -- built as a
// shared primitive (not a one-off in settings-panel.tsx) since "on/off"
// settings show up anywhere admin controls do, not just Social.
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "onChange">) {
  return (
    <label className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} className="peer sr-only" {...props} />
      <span className="absolute inset-0 rounded-full bg-surface-raised border border-border-strong transition-colors peer-checked:bg-indigo peer-checked:border-indigo peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
    </label>
  );
}
