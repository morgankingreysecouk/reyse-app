import { db } from "@/lib/db";

// Same facts as Reyse-Website's public/llms.txt -- this is the editable
// source of truth once the table exists; DEFAULT_KNOWLEDGE only seeds the
// single row the first time this is ever called, so the site's chat still
// works out of the box before anyone's touched the admin editor.
export const DEFAULT_KNOWLEDGE = `
About Reyse: an AI guest-messaging service for independent holiday-let (short-term rental) hosts. It answers guest questions instantly on the host's own website, WhatsApp, Instagram, and Facebook, using a knowledge base the host sets up about their property (amenities, house rules, check-in times, pet policy, parking, local tips). It is not a booking platform and does not replace Airbnb or Booking.com -- it runs alongside a host's existing channels.

Services (each sold independently, or bundled):
- Live Chat Widget: AI chat on the host's own property website. £99/month, £500 setup.
- WhatsApp Automation: AI replies to guest WhatsApp messages, same knowledge base. £99/month, £750 setup.
- Social Media Automation: AI replies to Instagram and Facebook DMs. £99/month, £1,000 setup.
- All three bundled: £297/month, £1,500 setup combined.
- Current offer: first month free on every service, and the setup fee is currently waived too, while onboarding early hosts. No credit card needed to start.

How it works: the host tells Reyse about their property (amenities, house rules, check-in time, pet policy, parking, local tips) and can update it any time. Reyse answers guest questions from that knowledge base. If it isn't confident about something, it collects the guest's details and passes them to the host, who can also jump into any conversation and take over.

Data handling: guest conversations and property details are not used to train public AI models.

Getting started: fill in the contact form on the site, or ask this chat to pass details along. Morgan personally calls within 1 business day and can have a host live within 24 hours.

Contact: morgan.king@reyse.co.uk. UK-based business, GBP pricing.
`.trim();

export async function getKnowledge(): Promise<{ id: string; content: string }> {
  const existing = await db.chatKnowledge.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existing) return existing;
  return db.chatKnowledge.create({ data: { content: DEFAULT_KNOWLEDGE } });
}
