import { Globe, MessageCircle, Camera, ThumbsUp, UserPen, type LucideIcon } from "lucide-react";
import type { EnquiryChannel } from "@/generated/prisma/client";

// lucide-react in this app's version dropped the brand-specific
// Instagram/Facebook glyphs (confirmed by checking the installed package
// directly, not assumed) -- Camera matches what nav.ts already uses for
// Instagram elsewhere in this app, kept consistent rather than picking
// something new.
const CHANNEL_CONFIG: Record<EnquiryChannel, { label: string; icon: LucideIcon }> = {
  WEBSITE: { label: "Website", icon: Globe },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  INSTAGRAM: { label: "Instagram", icon: Camera },
  FACEBOOK: { label: "Facebook", icon: ThumbsUp },
  MANUAL: { label: "Manual", icon: UserPen },
};

export function ChannelBadge({ channel }: { channel: EnquiryChannel }) {
  const config = CHANNEL_CONFIG[channel];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <Icon size={13} />
      {config.label}
    </span>
  );
}

export { CHANNEL_CONFIG };
