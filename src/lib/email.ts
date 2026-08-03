import { Resend } from "resend";

// reyse-app's first and only outbound-email capability -- everything else
// in this app (Mail Assistant) only ever reads Gmail, never sends. Same
// provider Reyse-Website already uses for its own emails (contact form,
// chat lead capture), so this is a proven pattern, not a new dependency
// chosen from scratch. Distinct `from` address from Reyse's own
// hello@/enquiries@ addresses, for clarity in a client's inbox that this is
// an automated alert, not a message from Morgan personally.
const FROM_ADDRESS = "Reyse Alerts <alerts@reyse.co.uk>";

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`RESEND_API_KEY is not set -- email "${input.subject}" to ${input.to} not sent.`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    html: input.html,
  });
}
