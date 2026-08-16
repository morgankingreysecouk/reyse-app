"use client";

import { useState } from "react";
import { Phone, Mail, AtSign, Link2, ExternalLink, User, RefreshCw, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClassificationBadge, EnrichmentBadge } from "./badges";
import type { Lead, LeadEmailVerification, LeadInstagramVerification } from "@/generated/prisma/client";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// "@handle" reads at a glance; the raw profile URL doesn't -- every social
// chip showing an identical truncated "https://www.instagram.c..." was the
// single worst thing about the first real look at this page.
function instagramHandle(url: string): string {
  try {
    const handle = new URL(url).pathname.replace(/^\//, "").replace(/\/$/, "");
    return handle ? `@${handle}` : "Instagram";
  } catch {
    return "Instagram";
  }
}

type VerifyTone = "valid" | "risky" | "invalid" | null;

function verifyToneOf(status: LeadEmailVerification | LeadInstagramVerification): VerifyTone {
  if (status === "VALID") return "valid";
  if (status === "RISKY") return "risky";
  if (status === "INVALID") return "invalid";
  return null; // UNVERIFIED -- no dot, nothing to signal yet
}

const VERIFY_DOT: Record<Exclude<VerifyTone, null>, { color: string; label: string }> = {
  valid: { color: "bg-success", label: "Verified" },
  risky: { color: "bg-warning", label: "Risky -- couldn't fully confirm" },
  invalid: { color: "bg-danger", label: "Invalid" },
};

// A verification result now renders as a small dot INSIDE the same pill as
// the value, not as a separate badge floating after it with a gap --
// that separation read as two unrelated pieces of information instead of
// one fact ("this email, and here's its status") at a glance.
function ContactField({
  icon,
  value,
  displayValue,
  placeholder,
  href,
  verify,
  onSave,
}: {
  icon: React.ReactNode;
  value: string | null;
  displayValue?: string;
  placeholder: string;
  href?: string;
  verify?: VerifyTone;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(draft.trim() || null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        className="px-2 py-0.5 text-xs rounded-md bg-surface-raised border border-indigo/60 text-ink outline-none w-44"
      />
    );
  }

  const dot = verify ? VERIFY_DOT[verify] : null;

  const content = (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border-strong text-xs text-ink-muted hover:border-ink-faint transition-colors max-w-[220px]">
      {icon}
      <span className="truncate">{displayValue ?? value ?? placeholder}</span>
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot.color}`} title={dot.label} />}
    </span>
  );

  if (value && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={dot ? `${value} -- ${dot.label}` : value}>
        {content}
      </a>
    );
  }
  return (
    <button onClick={() => setEditing(true)} title={value ? (dot ? `${value} -- ${dot.label}` : value) : undefined}>
      {content}
    </button>
  );
}

export function LeadCard({
  lead,
  onUpdate,
  onEnrich,
  onExclude,
  onVerifyEmail,
}: {
  lead: Lead;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<void>;
  onEnrich: (id: string) => Promise<void>;
  onExclude: (id: string) => Promise<void>;
  onVerifyEmail: (id: string, email: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"enrich" | "verify" | "exclude" | null>(null);

  const run = async (kind: "enrich" | "verify" | "exclude", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-ink font-semibold text-sm truncate">{lead.name}</span>
            <ClassificationBadge classification={lead.classification} />
            <EnrichmentBadge status={lead.enrichmentStatus} />
          </div>
          <p className="text-xs text-ink-muted mt-0.5 truncate">
            {lead.location && <>{lead.location} · </>}
            <a href={lead.url} target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">
              {domainOf(lead.url)}
            </a>
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("enrich", () => onEnrich(lead.id))}
            title="(Re-)enrich this lead"
          >
            {busy === "enrich" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("exclude", () => onExclude(lead.id))}
            title="Remove this lead"
          >
            {busy === "exclude" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <ContactField
          icon={<Phone size={12} />}
          value={lead.phone}
          placeholder="add phone"
          onSave={(v) => onUpdate(lead.id, { phone: v })}
        />
        <div className="flex items-center gap-0.5">
          <ContactField
            icon={<Mail size={12} />}
            value={lead.email}
            placeholder="add email"
            verify={lead.email ? verifyToneOf(lead.emailVerification) : undefined}
            onSave={(v) => onUpdate(lead.id, { email: v })}
          />
          {lead.email && (
            <button
              onClick={() => run("verify", () => onVerifyEmail(lead.id, lead.email!))}
              disabled={busy !== null}
              title="Re-verify this email"
              className="text-ink-faint hover:text-indigo transition-colors p-0.5"
            >
              {busy === "verify" ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            </button>
          )}
        </div>
        <ContactField
          icon={<AtSign size={12} />}
          value={lead.instagram}
          displayValue={lead.instagram ? instagramHandle(lead.instagram) : undefined}
          placeholder="add instagram"
          href={lead.instagram ?? undefined}
          verify={lead.instagram ? verifyToneOf(lead.instagramVerification) : undefined}
          onSave={(v) => onUpdate(lead.id, { instagram: v })}
        />
        <ContactField
          icon={<Link2 size={12} />}
          value={lead.linkedin}
          displayValue={lead.linkedin ? "LinkedIn" : undefined}
          placeholder="add linkedin"
          href={lead.linkedin ?? undefined}
          onSave={(v) => onUpdate(lead.id, { linkedin: v })}
        />
        <ContactField
          icon={<ExternalLink size={12} />}
          value={lead.facebook}
          displayValue={lead.facebook ? "Facebook" : undefined}
          placeholder="add facebook"
          href={lead.facebook ?? undefined}
          onSave={(v) => onUpdate(lead.id, { facebook: v })}
        />
        <ContactField
          icon={<User size={12} />}
          value={lead.contactName}
          placeholder="add name"
          onSave={(v) => onUpdate(lead.id, { contactName: v })}
        />
      </div>

      {lead.personalisationLine && (
        <p className="text-[11px] text-ink-faint italic mt-1.5">{lead.personalisationLine}</p>
      )}
      {lead.classification !== "INDEPENDENT" && lead.classificationReason && (
        <p className="text-[11px] text-ink-faint mt-1.5">
          {lead.excluded ? "Excluded" : "Note"}: {lead.classificationReason}
        </p>
      )}
    </div>
  );
}
