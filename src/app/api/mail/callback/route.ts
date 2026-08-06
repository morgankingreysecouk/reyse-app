import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectAccount } from "@/lib/mail/googleClient";
import { getRequestBaseUrl } from "@/lib/requestUrl";

// Google redirects the browser here after Morgan approves (or denies)
// access. Still an authenticated browser navigation with the normal
// session cookie attached, so the same session check applies.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");

  const mailUrl = new URL("/admin/mail", request.url);

  if (error) {
    mailUrl.searchParams.set("connectError", error);
    return NextResponse.redirect(mailUrl);
  }
  if (!code) {
    mailUrl.searchParams.set("connectError", "No authorization code returned");
    return NextResponse.redirect(mailUrl);
  }

  try {
    await connectAccount(code, getRequestBaseUrl(request));
    mailUrl.searchParams.set("connected", "true");
  } catch (err) {
    mailUrl.searchParams.set("connectError", err instanceof Error ? err.message : "Connection failed");
  }

  return NextResponse.redirect(mailUrl);
}
