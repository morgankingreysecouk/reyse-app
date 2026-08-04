// Shared between src/lib/dm/scheduler.ts (which constructs the payload)
// and the webhook route (which recognizes it) -- a reserved sentinel entry
// id lets the scheduled synthetic health check POST a realistic,
// correctly-signed fake webhook payload at the app's own live public URL
// and have it flow through the exact same signature-verification code path
// real traffic uses, without creating a real conversation or client
// lookup. This is the standing safeguard against a repeat of the old
// repo's webhook signature bug (see src/lib/dm/webhookAuth.ts) -- it
// exercises the deployed route end to end, not an in-process function call.
export const SYNTHETIC_HEALTH_CHECK_ENTRY_ID = "reyse-synthetic-health-check";
