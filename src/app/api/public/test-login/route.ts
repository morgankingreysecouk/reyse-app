import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

// TEMPORARY, throwaway-environment-only shortcut -- lets Morgan get straight
// into the admin dashboard on a disposable test copy of this branch without
// setting up a second Google OAuth redirect URI just to try something out.
// Completely inert everywhere else: it 404s unless TEST_LOGIN_SECRET is set,
// and that variable must never be set on the real production service. Under
// "api/public" specifically so proxy.ts's existing exclusion covers it
// without touching proxy.ts itself.
//
// MUST be deleted before this branch is ever merged for real -- it is not a
// backdoor into production (the env-var gate prevents that), but it has no
// reason to exist once real Google sign-in is wired up for a client-facing
// deploy.
export async function GET(request: NextRequest) {
  const testSecret = process.env.TEST_LOGIN_SECRET;
  if (!testSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== testSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET is not set" }, { status: 500 });
  }

  const maxAge = 8 * 60 * 60; // matches authOptions.session.maxAge
  const token = await encode({
    token: {
      name: "Morgan King",
      email: process.env.ADMIN_EMAIL || "morgan.king@reyse.co.uk",
      sub: "test-login",
    },
    secret,
    maxAge,
  });

  // Derived from forwarded headers, not request.url/request.nextUrl -- behind
  // Railway's edge proxy those reflect the internal address the container
  // sees itself on (e.g. http://localhost:3000), not the public address the
  // browser is actually using. Building the redirect target or the
  // https-ness check from the internal view sends the browser to an address
  // only reachable from inside the container -- confirmed the hard way.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const origin = `${isHttps ? "https" : "http"}://${host}`;

  const cookieName = isHttps ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  const response = NextResponse.redirect(new URL("/admin/clients/new", origin));
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
