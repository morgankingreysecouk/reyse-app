import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decryptToken } from "@/lib/dm/crypto";
import { PENDING_META_CANDIDATES_COOKIE, storeInstagramConnection, storeFacebookConnection } from "@/app/api/dm/meta/callback/route";
import type { MetaPageCandidate } from "@/lib/dm/metaOAuth";

// Finalizes the choice made on the meta-pages picker screen -- reads the
// same short-lived encrypted cookie the callback route set, finds the
// candidate Morgan picked, stores it as this client's real connection, and
// clears the cookie so the picker can't be resubmitted with stale data.
export async function POST(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const form = await request.formData();
  // pageId, not instagramAccountId -- a Facebook Page is always present on
  // every candidate (that's the whole picker list), while an Instagram
  // account might not be, so pageId is the one identifier guaranteed to
  // exist for every choice on the screen.
  const chosenId = form.get("pageId");

  const raw = request.cookies.get(PENDING_META_CANDIDATES_COOKIE)?.value;
  const target = new URL(`/admin/clients/${clientId}`, request.url);

  if (!raw || typeof chosenId !== "string") {
    target.searchParams.set("metaConnectError", "Connection attempt expired -- reconnect from the client page.");
    return NextResponse.redirect(target);
  }

  try {
    const decrypted = decryptToken(JSON.parse(raw));
    const parsed = JSON.parse(decrypted) as { clientId: string; candidates: MetaPageCandidate[] };
    if (parsed.clientId !== clientId) throw new Error("Client mismatch");

    const chosen = parsed.candidates.find((c) => c.pageId === chosenId);
    if (!chosen) throw new Error("Chosen Page not found in the pending list");

    await storeFacebookConnection(clientId, chosen);
    if (chosen.instagramAccountId) {
      await storeInstagramConnection(clientId, chosen);
    }
    target.searchParams.set("metaConnected", chosen.instagramAccountId ? "instagram-facebook" : "facebook");
  } catch (err) {
    target.searchParams.set("metaConnectError", err instanceof Error ? err.message : "Connection failed");
  }

  const response = NextResponse.redirect(target);
  response.cookies.delete(PENDING_META_CANDIDATES_COOKIE);
  return response;
}
