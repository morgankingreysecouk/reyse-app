import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEnquiryInput } from "@/lib/enquiries";

// Called server-to-server by the Reyse-Website contact form (api/contact.ts)
// -- no user session exists on that side, so this route is excluded from
// proxy.ts's session check and protects itself with a shared secret
// instead. Deliberately independent of the email Resend already sends from
// that same form: this saving to the database and that emailing Morgan are
// two separate, unrelated actions, so one failing does not affect the
// other. That redundancy is the whole point -- "not a lead goes missing."
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set -- refusing all public enquiry submissions.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateEnquiryInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const enquiry = await db.enquiry.create({
      data: { ...validated.data, channel: "WEBSITE" },
    });
    return NextResponse.json({ success: true, id: enquiry.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save enquiry:", error);
    return NextResponse.json({ error: "Failed to save enquiry" }, { status: 500 });
  }
}
