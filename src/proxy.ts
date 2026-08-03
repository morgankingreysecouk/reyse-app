import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Route protection (Next.js 16 renamed "middleware" to "proxy").
// Written directly against getToken rather than the next-auth/middleware
// wrapper, which isn't recognised as a valid proxy export on Next 16.
export default async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except the login page, the NextAuth API routes,
  // static/framework assets, api/public/*, and widget/widget.js.
  // api/public/* is called server-to-server by the marketing site's contact
  // form with no user session at all, so it can't sit behind a session
  // check -- it protects itself instead with its own API-key check (see
  // src/app/api/public/enquiries/route.ts). widget* is the embeddable Live
  // Chat widget itself (the loader script at /widget.js and its iframe
  // content at /widget/[widgetKey]) -- these are hit directly by anonymous
  // visitors on a client's own website, who have no session and never will;
  // the low-privilege widgetKey embedded in the script is what scopes
  // access there (see src/lib/widgetAuth.ts), the same way api/public/*
  // routes scope themselves. A session check on either of these would
  // redirect every real visitor straight to the admin login page instead
  // of loading the chat -- confirmed the hard way, caught by testing the
  // widget end to end rather than assuming the matcher already covered it.
  matcher: ["/((?!login|api/auth|api/public|widget|_next/static|_next/image|favicon.ico).*)"],
};
