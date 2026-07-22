// Runs once when the Next.js server process starts -- the supported hook
// for kicking off a long-running background job on a persistent server.
// Confirmed as the exact mechanism the old `reyse` backend used for its
// Instagram autopilot (a setInterval started from this same hook). Only
// makes sense on Railway's persistent Node process; would do nothing
// useful on Vercel's stateless serverless functions, which is why
// Reyse-Website's marketing site was deliberately kept off this pattern.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSocialScheduler } = await import("@/lib/social/scheduler");
    startSocialScheduler();
  }
}
