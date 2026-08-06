import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { decryptToken } from "@/lib/dm/crypto";
import { PENDING_META_CANDIDATES_COOKIE } from "@/app/api/dm/meta/callback/route";
import type { MetaPageCandidate } from "@/lib/dm/metaOAuth";
import { Card, CardContent } from "@/components/ui/card";

// Only reached when a client's Meta account administers more than one
// Facebook Page -- src/app/api/dm/meta/callback redirects here instead of
// connecting automatically, since guessing which Page a real client's DMs
// should come from would be a genuinely wrong default to pick silently.
export default async function MetaPagesPickerPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { clientId } = await params;
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_META_CANDIDATES_COOKIE)?.value;

  let candidates: MetaPageCandidate[] = [];
  if (raw) {
    try {
      const decrypted = decryptToken(JSON.parse(raw));
      const parsed = JSON.parse(decrypted) as { clientId: string; candidates: MetaPageCandidate[] };
      if (parsed.clientId === clientId) candidates = parsed.candidates;
    } catch {
      candidates = [];
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-xl font-semibold text-ink">Choose the Facebook Page to connect</h1>
      <p className="mt-2 text-sm text-ink-muted">
        More than one Facebook Page you administer is available. Pick the one that belongs to this client --
        Facebook Messenger connects either way, and Instagram connects too if that Page has one linked.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-6 text-sm text-danger">
          This link has expired or the connection attempt is no longer valid. Go back to the client and reconnect.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {candidates.map((candidate) => (
            <form key={candidate.pageId} action={`/api/clients/${clientId}/meta-pages`} method="POST">
              <input type="hidden" name="pageId" value={candidate.pageId} />
              <button type="submit" className="w-full text-left">
                <Card className="hover:border-ink-faint transition-colors">
                  <CardContent>
                    <div className="font-medium text-ink">{candidate.pageName}</div>
                    <div className="text-sm text-ink-muted">
                      {candidate.instagramAccountId
                        ? `Instagram + Facebook Messenger -- @${candidate.instagramUsername || "(no username)"}`
                        : "Facebook Messenger only -- no Instagram account linked to this Page"}
                    </div>
                  </CardContent>
                </Card>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
