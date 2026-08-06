"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Type-to-filter picker for a known, fixed list of options -- not a full
// autocomplete against arbitrary user text. There's no existing Select
// primitive in this app yet (every page just used a raw styled <select>);
// this is the first thing that needed typing-to-filter rather than a plain
// pick-from-a-list, so it's a new shared primitive rather than one-off.
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === value.toLowerCase()) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query, value]);

  function select(option: string) {
    onChange(option);
    setQuery(option);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              select(filtered[0]);
              e.currentTarget.blur();
            }
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-8 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo transition-colors placeholder:text-ink-faint disabled:opacity-50 disabled:pointer-events-none"
        />
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-border-strong bg-surface shadow-xl py-1">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(option)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm transition-colors",
                option === value ? "text-indigo bg-indigo/10" : "text-ink hover:bg-surface-raised"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
