import { Badge } from "@/components/ui/badge";
import type { EnquiryStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<EnquiryStatus, { label: string; tone: "indigo" | "warning" | "success" | "danger" }> = {
  NEW: { label: "New", tone: "indigo" },
  CONTACTED: { label: "Contacted", tone: "warning" },
  WON: { label: "Won", tone: "success" },
  LOST: { label: "Lost", tone: "danger" },
};

export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export const STATUS_OPTIONS: EnquiryStatus[] = ["NEW", "CONTACTED", "WON", "LOST"];
export { STATUS_CONFIG };
