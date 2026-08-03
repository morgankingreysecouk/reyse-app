import type { Metadata } from "next";
import { resolveClientFromWidgetKey } from "@/lib/widgetAuth";

// Overrides the root layout's "Reyse Admin" tab title/description for this
// one white-labeled route -- this iframe is served under a client's own
// site, so a visitor who opens it directly (devtools, a new tab) should see
// that client's own name, not Reyse's internal admin console. Also opts out
// of indexing: this is an embed-only utility page with no standalone
// content of its own, not something that should ever surface in search
// results for a client's business name.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ widgetKey: string }>;
}): Promise<Metadata> {
  const { widgetKey } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  const title = client ? `${client.assistantName} · ${client.businessName}` : "Chat";

  return {
    title,
    description: client ? `Chat with ${client.assistantName}` : "Chat",
    robots: { index: false, follow: false },
  };
}

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
