import { MessageCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function LiveChatPage() {
  return (
    <PlaceholderPage
      icon={MessageCircle}
      title="Live Chat"
      description="Monitor active AI conversations and jump in as an agent when needed."
    />
  );
}
