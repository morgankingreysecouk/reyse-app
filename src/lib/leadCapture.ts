import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type { Client, Property } from "@/generated/prisma/client";

export interface CaptureLeadInput {
  fullName: string;
  email?: string;
  phone?: string;
  propertyName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestCount?: string;
  message?: string;
}

function buildEnquiryMessage(input: CaptureLeadInput): string | undefined {
  const details: string[] = [];
  if (input.checkInDate) details.push(`Check-in: ${input.checkInDate}`);
  if (input.checkOutDate) details.push(`Check-out: ${input.checkOutDate}`);
  if (input.guestCount) details.push(`Guests: ${input.guestCount}`);
  if (input.message) details.push(input.message);
  return details.length > 0 ? details.join("\n") : undefined;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function sendLeadEmail(client: Client, input: CaptureLeadInput): Promise<void> {
  await sendEmail({
    to: client.notificationEmail,
    replyTo: input.email || undefined,
    subject: `New enquiry via your ${client.assistantName} chat: ${input.fullName}`,
    html: `
      <h2>New enquiry from your website chat</h2>
      <p><strong>Name:</strong> ${escapeHtml(input.fullName)}</p>
      ${input.email ? `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>` : ""}
      ${input.phone ? `<p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>` : ""}
      ${input.propertyName ? `<p><strong>Property:</strong> ${escapeHtml(input.propertyName)}</p>` : ""}
      ${input.checkInDate ? `<p><strong>Check-in:</strong> ${escapeHtml(input.checkInDate)}</p>` : ""}
      ${input.checkOutDate ? `<p><strong>Check-out:</strong> ${escapeHtml(input.checkOutDate)}</p>` : ""}
      ${input.guestCount ? `<p><strong>Guests:</strong> ${escapeHtml(input.guestCount)}</p>` : ""}
      ${input.message ? `<p><strong>Message:</strong></p><p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}
      <p style="color:#666;font-size:12px;margin-top:24px;">Sent automatically by your ${escapeHtml(client.assistantName)} chat assistant.</p>
    `,
  });
}

// Called the instant the AI's capture_lead tool fires. Writes the Enquiry
// row first, always -- matches this codebase's own established "redundancy
// is the whole point" philosophy for /api/public/enquiries -- then attempts
// the client email. An email failure is logged but never loses the lead,
// since the Enquiry row is already the safety net. There is no client
// portal (a deliberate decision, 3 August 2026), so the email itself is the
// entire deliverable to the client -- never reference "your dashboard" in
// its copy.
export async function captureLead(
  client: Client,
  property: Property | null,
  conversationId: string,
  input: CaptureLeadInput,
): Promise<void> {
  await db.enquiry.create({
    data: {
      fullName: input.fullName,
      email: input.email || "",
      phone: input.phone || "",
      businessName: property?.name ?? client.businessName,
      message: buildEnquiryMessage(input),
      channel: "WEBSITE",
      clientId: client.id,
    },
  });

  try {
    await sendLeadEmail(client, input);
  } catch (error) {
    console.error(
      `Failed to email lead notification for client ${client.id} (conversation ${conversationId}):`,
      error,
    );
  }
}
