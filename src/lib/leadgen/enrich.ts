import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logAiUsage } from "@/lib/aiUsageLog";
import { extractText, fetchHtmlWithRetry } from "./fetchSite";
import { verifyEmail } from "./verifyEmail";
import { verifyInstagram } from "./verifyInstagram";
import type { LeadEmailVerification, LeadEnrichmentStatus, LeadInstagramVerification } from "@/generated/prisma/client";

const MODEL = "claude-haiku-4-5-20251001";

export interface EnrichedContacts {
  phone: string | null;
  email: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  contactName: string | null;
  personalisationLine: string | null;
}

export interface EnrichResult extends EnrichedContacts {
  enrichmentStatus: LeadEnrichmentStatus;
  emailVerification: LeadEmailVerification;
  instagramVerification: LeadInstagramVerification;
}

const JUNK_EMAIL_DOMAINS = [
  "sentry.io",
  "wix.com",
  "wixpress.com",
  "squarespace.com",
  "shopify.com",
  "godaddy.com",
  "example.com",
  "domain.com",
  "yourdomain.com",
  "cloudflare.com",
  "google.com",
  "wordpress.com",
];
const JUNK_EMAIL_PREFIXES = ["noreply", "no-reply", "test", "demo", "example", "sentry", "webmaster@wix"];

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1] ?? "";
  if (JUNK_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  if (JUNK_EMAIL_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return false;
}

function extractEmail(html: string): string | null {
  const mailto = html.match(/mailto:([^"'\s?)]+)/i);
  if (mailto?.[1] && !isJunkEmail(mailto[1])) return mailto[1].toLowerCase();
  const text = extractText(html, 20000);
  const matches = text.match(/[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const clean = matches.map((m) => m.toLowerCase()).find((m) => !isJunkEmail(m));
  return clean ?? null;
}

function extractPhone(html: string): string | null {
  const tel = html.match(/tel:([+\d\s()-]{7,})/i);
  if (tel?.[1]) return tel[1].trim();
  const text = extractText(html, 20000);
  const match = text.match(/(?:\+44\s?7\d{3}|07\d{3}|\+44\s?[1-3]\d{2,3}|0[1-3]\d{2,3}|0800)[\s-]?\d{3,4}[\s-]?\d{3,4}/);
  return match?.[0]?.trim() ?? null;
}

function extractProfileLink(html: string, hostFragment: string, excludePaths: string[]): string | null {
  const regex = new RegExp(`href=["'](https?:\\/\\/(?:www\\.)?${hostFragment}\\/[^"'\\s]+)["']`, "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const link = match[1];
    const lower = link.toLowerCase();
    if (excludePaths.some((p) => lower.includes(p))) continue;
    return link.split(/[?#]/)[0];
  }
  return null;
}

function extractAll(html: string): EnrichedContacts {
  return {
    email: extractEmail(html),
    phone: extractPhone(html),
    instagram: extractProfileLink(html, "instagram\\.com", ["/p/", "/reel/", "/explore/", "/tv/", "/stories/"]),
    linkedin: extractProfileLink(html, "linkedin\\.com", ["/jobs", "/help", "/pulse/", "/posts/"]),
    facebook: extractProfileLink(html, "facebook\\.com", ["/sharer", "/plugins/", "/help/", "/policies/"]),
    contactName: null,
    personalisationLine: null,
  };
}

function findContactUrl(html: string, baseUrl: string): string | null {
  const base = new URL(baseUrl);
  const regex = /href=["']([^"'\s]+)["'][^>]*>([^<]*)</gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const [, href, text] = match;
    if (/contact/i.test(href) || /contact/i.test(text)) {
      try {
        const resolved = new URL(href, base);
        if (resolved.hostname === base.hostname) return resolved.toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

function foundCount(c: EnrichedContacts): number {
  return [c.phone, c.email, c.instagram].filter(Boolean).length;
}

const AI_SCHEMA = {
  type: "object",
  properties: {
    phone: { type: ["string", "null"], description: "UK phone number if genuinely present, else null" },
    email: { type: ["string", "null"], description: "Contact email if genuinely present, else null" },
    instagram: { type: ["string", "null"], description: "Full Instagram profile URL if genuinely present, else null" },
    linkedin: { type: ["string", "null"], description: "Full LinkedIn profile/company URL if genuinely present, else null" },
    facebook: { type: ["string", "null"], description: "Full Facebook page URL if genuinely present, else null" },
    contactName: { type: ["string", "null"], description: "Named owner/host if mentioned, else null" },
    personalisationLine: {
      type: ["string", "null"],
      description:
        "One short warm sentence (max 25 words) referencing something specific and real about this property/business, for the opening line of an outreach message. Start with 'I came across' or 'I noticed' or 'Your'. Do NOT mention Reyse or AI. Null if nothing genuine to reference.",
    },
  },
  required: ["phone", "email", "instagram", "linkedin", "facebook", "contactName", "personalisationLine"],
  additionalProperties: false,
};

function isPlaceholder(value: string | null): boolean {
  if (!value) return true;
  const lower = value.toLowerCase().trim();
  return ["null", "n/a", "none", "your name", "your instagram", "instagram.com/handle", "%20"].some((p) =>
    lower.includes(p),
  );
}

async function aiFillGaps(text: string, businessName: string): Promise<Partial<EnrichedContacts>> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    output_config: { format: { type: "json_schema", schema: AI_SCHEMA } },
    system:
      "You extract real contact details and write one short personalisation line from a business's website text. Never invent a value that isn't genuinely present -- return null rather than guess.",
    messages: [{ role: "user", content: `Business name: ${businessName}\n\nWebsite text:\n\n${text}` }],
  });

  await logAiUsage({
    feature: "leadgen-enrich",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return {};
  const parsed = JSON.parse(textBlock.text) as Record<string, string | null>;

  const out: Partial<EnrichedContacts> = {};
  for (const key of ["phone", "email", "instagram", "linkedin", "facebook", "contactName", "personalisationLine"] as const) {
    const value = parsed[key];
    if (!isPlaceholder(value)) out[key] = value;
  }
  return out;
}

// Cross-lead dedup for email/instagram -- if the AI (or regex) finds a
// contact detail already attached to a different lead, drop it rather than
// let two lead rows silently carry the same email/handle. Doesn't prevent
// duplicate leads by itself (domain uniqueness at search time does that);
// this catches the narrower case of two genuinely different businesses
// sharing a shared/agency-run inbox or social account.
async function dedupeAgainstOtherLeads(contacts: EnrichedContacts, ownDomain: string): Promise<EnrichedContacts> {
  const result = { ...contacts };
  if (result.email) {
    const dup = await db.lead.findFirst({ where: { email: result.email, domain: { not: ownDomain } } });
    if (dup) result.email = null;
  }
  if (result.instagram) {
    const dup = await db.lead.findFirst({ where: { instagram: result.instagram, domain: { not: ownDomain } } });
    if (dup) result.instagram = null;
  }
  return result;
}

export async function enrichLead(params: { url: string; domain: string; name: string }): Promise<EnrichResult> {
  let html: string;
  try {
    html = await fetchHtmlWithRetry(params.url);
  } catch {
    return {
      phone: null,
      email: null,
      instagram: null,
      linkedin: null,
      facebook: null,
      contactName: null,
      personalisationLine: null,
      enrichmentStatus: "FAILED",
      emailVerification: "UNVERIFIED",
      instagramVerification: "UNVERIFIED",
    };
  }

  let contacts = extractAll(html);

  if (foundCount(contacts) < 2) {
    const contactUrl = findContactUrl(html, params.url);
    if (contactUrl) {
      try {
        const contactHtml = await fetchHtmlWithRetry(contactUrl);
        const contactContacts = extractAll(contactHtml);
        contacts = {
          phone: contacts.phone ?? contactContacts.phone,
          email: contacts.email ?? contactContacts.email,
          instagram: contacts.instagram ?? contactContacts.instagram,
          linkedin: contacts.linkedin ?? contactContacts.linkedin,
          facebook: contacts.facebook ?? contactContacts.facebook,
          contactName: null,
          personalisationLine: null,
        };
      } catch {
        // Contact page unreachable -- proceed with whatever the homepage gave us.
      }
    }
  }

  if (foundCount(contacts) < 3 || !contacts.contactName || !contacts.personalisationLine) {
    try {
      const filled = await aiFillGaps(extractText(html, 6000), params.name);
      contacts = {
        phone: contacts.phone ?? filled.phone ?? null,
        email: contacts.email ?? filled.email ?? null,
        instagram: contacts.instagram ?? filled.instagram ?? null,
        linkedin: contacts.linkedin ?? filled.linkedin ?? null,
        facebook: contacts.facebook ?? filled.facebook ?? null,
        contactName: contacts.contactName ?? filled.contactName ?? null,
        personalisationLine: contacts.personalisationLine ?? filled.personalisationLine ?? null,
      };
    } catch (error) {
      console.error(`AI gap-fill failed for ${params.domain}:`, error);
    }
  }

  contacts = await dedupeAgainstOtherLeads(contacts, params.domain);

  const count = foundCount(contacts);
  const enrichmentStatus: LeadEnrichmentStatus = count === 3 ? "COMPLETE" : count > 0 ? "PARTIAL" : "NOT_FOUND";

  let emailVerification: LeadEmailVerification = "UNVERIFIED";
  if (contacts.email) {
    const result = await verifyEmail(contacts.email);
    emailVerification = result.verification;
  }

  let instagramVerification: LeadInstagramVerification = "UNVERIFIED";
  if (contacts.instagram) {
    const result = await verifyInstagram(contacts.instagram);
    instagramVerification = result.verification;
    if (result.verification === "INVALID") contacts.instagram = null;
  }

  return { ...contacts, enrichmentStatus, emailVerification, instagramVerification };
}
