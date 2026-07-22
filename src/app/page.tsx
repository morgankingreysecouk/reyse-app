import { redirect } from "next/navigation";

// Everything moved under /admin (22 July 2026) -- without this, hitting the
// bare domain would 404 instead of landing somewhere useful. proxy.ts
// already gates this route (redirects to /login with no session), so by
// the time this renders the visitor is authenticated.
export default function RootPage() {
  redirect("/admin");
}
