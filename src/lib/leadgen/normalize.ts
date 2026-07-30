// The single normalization function every dedup check in this feature goes
// through. The old backend's dedup broke because it treated the raw URL
// string as the identity of a lead -- http vs https, www vs bare, a trailing
// slash, all counted as different leads. A domain is the real identity of a
// business's website; this collapses all of those variants to one string.
export function normalizeDomain(input: string): string | null {
  let host: string;
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    host = new URL(withProtocol).hostname;
  } catch {
    return null;
  }
  return host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "") || null;
}

export function canonicalUrl(domain: string): string {
  return `https://${domain}`;
}
