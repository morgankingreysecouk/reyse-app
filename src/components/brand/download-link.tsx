import { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// An <a>-rendered equivalent of Button's "secondary"/"sm" look. Kept separate from
// components/ui/button.tsx (a real <button>) rather than nesting a <button> inside
// an <a> for these downloads, which is invalid HTML.
export function DownloadLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center h-8 px-3 text-sm rounded-md gap-1.5 font-medium transition-colors",
        "bg-surface-raised text-ink border border-border-strong hover:border-ink-faint",
        className
      )}
      {...props}
    />
  );
}
