import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic route -- dumps exactly what headers and Railway env
// vars this deployment actually sees, so the public-URL detection in
// test-login/route.ts can be built from real evidence instead of assumed
// proxy header conventions. Same TEST_LOGIN_SECRET gate as test-login, so
// it's equally inert unless that variable is deliberately set. Delete
// alongside test-login before this branch is ever merged for real.
export async function GET(request: NextRequest) {
  if (!process.env.TEST_LOGIN_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const railwayEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("RAILWAY_") || key === "PORT") {
      railwayEnv[key] = value ?? "";
    }
  }

  return NextResponse.json({
    headers,
    railwayEnv,
    nextUrl: { host: request.nextUrl.host, protocol: request.nextUrl.protocol },
    requestUrl: request.url,
  });
}
