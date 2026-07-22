import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Settings"
      description="Account, integrations, and system configuration will live here."
    />
  );
}
