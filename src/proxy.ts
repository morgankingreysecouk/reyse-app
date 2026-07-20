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
  // and static/framework assets. Anything not matched here requires a
  // signed-in session with the allowlisted email (enforced in auth.ts).
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
