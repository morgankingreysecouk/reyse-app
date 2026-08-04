import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { checkDueConnections } from "@/lib/dm/metaTokenHealth";
import { notifyPlatformIssue } from "@/lib/dm/notifications";
import { SYNTHETIC_HEALTH_CHECK_ENTRY_ID } from "@/lib/dm/syntheticHealthCheck";

// Same 5-minute tick shape as src/lib/social/scheduler.ts and
// src/lib/mail/scheduler.ts -- the only scheduling mechanism this stack
// has (Railway's single persistent Node process, no external cron/queue
// infrastructure). Each job gates its own real work behind a due-time
// check, so most ticks are cheap no-ops, same pattern as the other two
// schedulers.
//
// This is a bare in-process setInterval with no distributed lock --
// correct and sufficient only because Railway runs exactly one persistent
// process for this app today. It would double-fire and race if this
// service is ever scaled to multiple instances -- stated plainly here,
// not silently assumed safe at any scale, same as social/scheduler.ts's
// own comment about itself.
const TICK_INTERVAL_MS = 5 * 60 * 1000;
const SYNTHETIC_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FAILURE_ALERT_THROTTLE_MS = 6 * 60 * 60 * 1000;

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://reyse-app-production.up.railway.app";

async function maybeCheckTokenHealth(): Promise<void> {
  await checkDueConnections();
}

// The standing safeguard against a repeat of the old repo's actual
// root-cause bug: constructs a realistic, correctly-signed fake Instagram
// webhook payload and POSTs it to this app's own live public URL --
// deliberately a real HTTP round trip to the deployed route, not an
// in-process function call -- so it exercises the exact signature
// verification path real traffic uses. See src/lib/dm/webhookAuth.ts and
// the abandoned old repo's bc00490 commit message for why this specific
// check exists.
async function maybeRunSyntheticWebhookCheck(): Promise<void> {
  const lastRun = await db.dmWebhookHealthCheckLog.findFirst({ orderBy: { ranAt: "desc" } });
  if (lastRun && Date.now() - lastRun.ranAt.getTime() < SYNTHETIC_CHECK_INTERVAL_MS) return;

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("DM webhook health check skipped: META_APP_SECRET is not set");
    return;
  }

  const payload = JSON.stringify({ object: "instagram", entry: [{ id: SYNTHETIC_HEALTH_CHECK_ENTRY_ID }] });
  const signature = `sha256=${createHmac("sha256", appSecret).update(payload, "utf8").digest("hex")}`;

  // Captured before the request, not after -- the webhook route writes its
  // own DmWebhookHealthCheckLog row for this very attempt as part of
  // handling it, so a query for "prior failures" has to exclude that row
  // by time, not just by re-running the same findFirst and hoping it's a
  // different one.
  const requestStartedAt = new Date();

  let ok = false;
  let detail = "";
  try {
    const res = await fetch(`${PUBLIC_BASE_URL}/api/public/dm/webhook/instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
      body: payload,
    });
    ok = res.ok;
    if (!ok) detail = `Webhook responded HTTP ${res.status}`;
  } catch (error) {
    detail = `Request to the webhook route failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  // The webhook route itself already wrote a DmWebhookHealthCheckLog row
  // for this attempt (ok:true for a recognised sentinel + valid signature,
  // ok:false for a signature mismatch) -- that row is the durable record.
  // This function's own job is just deciding whether to alert, throttled
  // so a persistent outage pages Morgan once, not every hour it stays
  // broken.
  if (!ok) {
    const priorFailure = await db.dmWebhookHealthCheckLog.findFirst({
      where: { ok: false, ranAt: { lt: requestStartedAt } },
      orderBy: { ranAt: "desc" },
    });
    const alreadyAlerted =
      priorFailure && requestStartedAt.getTime() - priorFailure.ranAt.getTime() < FAILURE_ALERT_THROTTLE_MS;
    if (!alreadyAlerted) {
      await notifyPlatformIssue(
        "DM webhook health check failed",
        `The scheduled synthetic check against the Instagram DM webhook failed: ${detail}\n\nThis means real inbound guest DMs may be silently failing right now -- the same class of bug that broke the old system for a real stretch of time with no alert. Check the webhook route and META_APP_SECRET/META_WEBHOOK_VERIFY_TOKEN configuration.`,
      );
    }
  }
}

let started = false;

export function startDmScheduler(): void {
  if (started) return;
  started = true;
  console.log("DM Automation: scheduler started, checking every 5 minutes.");

  const tick = () => {
    maybeCheckTokenHealth().catch((error) => console.error("DM scheduler tick (token health) failed:", error));
    maybeRunSyntheticWebhookCheck().catch((error) => console.error("DM scheduler tick (webhook health) failed:", error));
  };

  setInterval(tick, TICK_INTERVAL_MS);
}
