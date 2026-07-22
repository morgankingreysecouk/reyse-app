import { TalkVoiceSettings } from "@/components/settings/talk-voice-settings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="font-display text-xl font-semibold text-ink">Settings</h1>
      <TalkVoiceSettings />
    </div>
  );
}
