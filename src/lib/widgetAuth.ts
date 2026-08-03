import { db } from "@/lib/db";
import type { Client } from "@/generated/prisma/client";

// Resolves the public, client-side-safe widgetKey embedded in a client's
// script tag to the real Client row it identifies -- this is the access
// boundary for every /api/public/widget/[widgetKey]/** route, replacing
// INTERNAL_API_SECRET (which stays a pure server-to-server credential and
// never reaches a browser). Returns null for anything that shouldn't be
// allowed to serve a widget right now: not found, soft-deleted, or paused.
export async function resolveClientFromWidgetKey(widgetKey: string): Promise<Client | null> {
  if (!widgetKey) return null;
  const client = await db.client.findUnique({ where: { widgetKey } });
  if (!client || client.deletedAt || !client.enabled) return null;
  return client;
}

// Best-effort attribution/abuse-resistance, not a real security boundary --
// Origin/Referer are trivially spoofable by anything that isn't a real
// browser, and sometimes simply absent from legitimate requests (privacy
// extensions, certain navigations). A mismatch is logged for visibility (so
// Morgan can spot a widget key live on an unregistered domain in Railway's
// logs) rather than hard-blocked, to avoid false-positive breakage. The
// actual data-access boundary is resolveClientFromWidgetKey scoping every
// read/write to exactly one client, plus rate limiting.
export function validateOrigin(client: Client, request: Request): void {
  if (client.allowedDomains.length === 0) return; // nothing registered yet, don't block onboarding
  const origin = request.headers.get("origin");
  if (!origin) return; // absent is common and not itself suspicious

  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return;
  }

  const matches = client.allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!matches) {
    console.warn(
      `Widget request for client ${client.id} (${client.businessName}) came from unregistered origin "${origin}" -- allowed: ${client.allowedDomains.join(", ")}`,
    );
  }
}
