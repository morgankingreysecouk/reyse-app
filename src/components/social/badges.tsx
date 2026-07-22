import { Badge } from "@/components/ui/badge";
import type { SocialPillar, SocialPlatform, SocialPostStatus } from "@/generated/prisma/client";

const PILLAR_LABEL: Record<SocialPillar, string> = {
  EDUCATION: "Education",
  TIPS: "Tips",
  PROMOTION: "Promotion",
  SOCIAL_PROOF: "Social proof",
  BEHIND_THE_SCENES: "Behind the scenes",
  NEWS: "News",
};

export function PillarBadge({ pillar }: { pillar: SocialPillar }) {
  return <Badge tone="indigo">{PILLAR_LABEL[pillar]}</Badge>;
}

export function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  return (
    <Badge tone="neutral" className={platform === "INSTAGRAM" ? "border-pink-400/30 text-pink-300" : "border-blue-400/30 text-blue-300"}>
      {platform === "INSTAGRAM" ? "Instagram" : "Facebook"}
    </Badge>
  );
}

const STATUS_TONE: Record<SocialPostStatus, "neutral" | "success" | "warning" | "danger" | "indigo"> = {
  DRAFT: "neutral",
  SCHEDULED: "indigo",
  PUBLISHED: "success",
  FAILED: "danger",
  REJECTED: "warning",
};

const STATUS_LABEL: Record<SocialPostStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: SocialPostStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
