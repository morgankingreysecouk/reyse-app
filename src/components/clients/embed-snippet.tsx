"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reads the app's own current origin at render time (not a hardcoded
// domain) -- correct by construction whether this is opened via the
// Railway URL or app.reyse.co.uk, same reasoning already applied to the
// widget's own loader script and the Mail Assistant's OAuth redirect URI.
export function EmbedSnippet({ widgetKey }: { widgetKey: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${origin}/widget.js" data-reyse-key="${widgetKey}" async></script>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) --
      // the snippet is still visible and selectable by hand.
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-muted">
        Paste this once, anywhere in the site&apos;s HTML (just before <code>&lt;/body&gt;</code> is the usual spot):
      </p>
      <div className="flex items-start gap-2">
        <code className="flex-1 block px-3 py-2.5 rounded-md bg-surface-raised border border-border-strong text-xs text-ink font-mono break-all">
          {snippet}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
