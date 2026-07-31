import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getConsentUrl } from "@/lib/mail/googleClient";

// Kicks off the one-time Google consent flow for the dedicated
// "Reyse Mail Assistant" OAuth client. Session check here is belt-and-
// braces -- proxy.ts already blocks unauthenticated requests.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.redirect(getConsentUrl());
  } catch (err) {
    // Most likely cause: GMAIL_CLIENT_ID/SECRET not set on this deploy yet.
    // Send Morgan back to the Mail page with a plain-language reason
    // instead of Next's raw error page.
    const mailUrl = new URL("/admin/mail", request.url);
    mailUrl.searchParams.set(
      "connectError",
      err instanceof Error ? err.message : "Couldn't start the connection",
    );
    return NextResponse.redirect(mailUrl);
  }
}
