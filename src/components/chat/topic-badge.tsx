import { PoundSterling, HelpCircle, Rocket, MessageCircle, type LucideIcon } from "lucide-react";
import type { ChatTopic } from "@/generated/prisma/client";

export const TOPIC_CONFIG: Record<ChatTopic, { label: string; icon: LucideIcon }> = {
  PRICING: { label: "Pricing", icon: PoundSterling },
  HOW_IT_WORKS: { label: "How it works", icon: HelpCircle },
  GETTING_STARTED: { label: "Getting started", icon: Rocket },
  OTHER: { label: "Other", icon: MessageCircle },
};

export function TopicBadge({ topic }: { topic: ChatTopic }) {
  const config = TOPIC_CONFIG[topic];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <Icon size={13} />
      {config.label}
    </span>
  );
}
