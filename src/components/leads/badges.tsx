import { Badge } from "@/components/ui/badge";
import type {
  LeadClassification,
  LeadEmailVerification,
  LeadEnrichmentStatus,
  LeadInstagramVerification,
} from "@/generated/prisma/client";

const CLASSIFICATION_CONFIG: Record<LeadClassification, { label: string; tone: "indigo" | "warning" | "neutral" | "danger" }> = {
  INDEPENDENT: { label: "Independent", tone: "indigo" },
  PLATFORM: { label: "Platform", tone: "neutral" },
  IRRELEVANT: { label: "Irrelevant", tone: "neutral" },
  ERROR: { label: "Unreachable", tone: "warning" },
};

export function ClassificationBadge({ classification }: { classification: LeadClassification }) {
  const c = CLASSIFICATION_CONFIG[classification];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

const ENRICHMENT_CONFIG: Record<LeadEnrichmentStatus, { label: string; tone: "indigo" | "warning" | "success" | "neutral" | "danger" }> = {
  PENDING: { label: "Not enriched", tone: "neutral" },
  COMPLETE: { label: "Fully enriched", tone: "success" },
  PARTIAL: { label: "Partially enriched", tone: "warning" },
  NOT_FOUND: { label: "No contacts found", tone: "neutral" },
  FAILED: { label: "Enrichment failed", tone: "danger" },
};

export function EnrichmentBadge({ status }: { status: LeadEnrichmentStatus }) {
  const c = ENRICHMENT_CONFIG[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

const EMAIL_VERIFY_CONFIG: Record<LeadEmailVerification, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  UNVERIFIED: { label: "Unverified", tone: "neutral" },
  VALID: { label: "Verified", tone: "success" },
  RISKY: { label: "Risky", tone: "warning" },
  INVALID: { label: "Invalid", tone: "danger" },
};

export function EmailVerificationBadge({ status }: { status: LeadEmailVerification }) {
  const c = EMAIL_VERIFY_CONFIG[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

const IG_VERIFY_CONFIG: Record<LeadInstagramVerification, { label: string; tone: "success" | "danger" | "neutral" }> = {
  UNVERIFIED: { label: "Unverified", tone: "neutral" },
  VALID: { label: "Verified", tone: "success" },
  INVALID: { label: "Invalid", tone: "danger" },
};

export function InstagramVerificationBadge({ status }: { status: LeadInstagramVerification }) {
  const c = IG_VERIFY_CONFIG[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
