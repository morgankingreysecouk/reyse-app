"use client";

import { cn } from "@/lib/cn";

// Ten clickable pips, filled up to the current rating. Clicking the
// currently-selected pip clears the rating (toggle off) rather than forcing
// it to stay set. Saves are the caller's job (called on every click, no
// separate confirm step) -- rating is a single discrete action, unlike the
// feedback text which needs debouncing.
export function RatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            aria-label={`Rate ${n} out of 10`}
            className={cn(
              "h-6 w-4 rounded-sm transition-colors disabled:opacity-50",
              value !== null && n <= value ? "bg-indigo" : "bg-surface-raised border border-border-strong hover:border-ink-faint",
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-ink-muted tabular-nums w-14 shrink-0">
        {value !== null ? `${value} / 10` : "Not rated"}
      </span>
    </div>
  );
}
