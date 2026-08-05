import { Resend } from "resend";
import { ADMIN_EMAIL } from "@/lib/auth";

// reyse-app's first own use of Resend -- every other email in this
// business (contact form, live chat's send_enquiry) is sent from the
// separate Reyse-Website Vercel project. DM Automation's escalation and
// booking notifications have to originate here instead, since the whole
// point is reyse-app (Railway's persistent process) being the thing
// holding the Meta webhook connection and reacting to it in real time --
// see reyse-app/CLAUDE.md's DM Automation section for why this feature
// can't use Reyse-Website's existing split.
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set -- DM notification email not sent");
    return null;
  }
  return new Resend(apiKey);
}

const FROM_ADDRESS = "Reyse DM Automation <notifications@reyse.co.uk>";

// Fire-and-forget, same instinct as logAiUsage -- a notification email
// failing to send must never take down the reply/booking flow that
// triggered it. The DmActivityLog row is the real, durable record of what
// happened; the email is a convenience on top of it.
async function sendNotification(to: string, subject: string, text: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.emails.send({ from: FROM_ADDRESS, to, subject, text });
  } catch (error) {
    console.error(`Failed to send DM notification email to ${to}:`, error);
  }
}

export async function notifyEscalation(params: {
  notificationEmail: string;
  clientName: string;
  conversationId: string;
  reason: string;
  baseUrl: string;
}): Promise<void> {
  await sendNotification(
    params.notificationEmail,
    `[Reyse] A guest DM needs you -- ${params.clientName}`,
    `A guest conversation on ${params.clientName}'s Instagram was handed off to a human.\n\nReason: ${params.reason}\n\nReply here: ${params.baseUrl}/admin/clients?conversation=${params.conversationId}\n`,
  );
}

export async function notifyBooking(params: {
  notificationEmail: string;
  clientName: string;
  propertyName: string;
  guestName: string;
  startDate: Date;
  endDate: Date;
  pushedToGoogleCalendar: boolean;
  baseUrl: string;
}): Promise<void> {
  const format = (d: Date) => d.toISOString().slice(0, 10);
  const googleNote = params.pushedToGoogleCalendar
    ? " It's also been added to your connected Google Calendar."
    : "";
  await sendNotification(
    params.notificationEmail,
    `[Reyse] New booking -- ${params.propertyName}`,
    `${params.guestName} was confirmed for ${params.propertyName} (${format(params.startDate)} to ${format(params.endDate)}) via your Instagram DM automation.\n\nThis blocks the dates in Reyse's own record.${googleNote} It does not and cannot create a reservation directly on Airbnb or Booking.com -- no third-party API exists for that, so if those listings need updating too, that's still down to you.\n\nView it: ${params.baseUrl}/admin/clients\n`,
  );
}

// A platform-level failure (the webhook itself is broken for every
// client, not just one) has no natural clientId to attach to -- goes to
// Morgan directly rather than through any one client's notificationEmail.
export async function notifyPlatformIssue(subject: string, detail: string): Promise<void> {
  await sendNotification(ADMIN_EMAIL, `[Reyse] ${subject}`, detail);
}
