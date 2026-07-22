// Real Kokoro-82M voice roster (confirmed via DeepInfra/Hugging Face docs,
// not guessed) -- grade is the community-assigned rough quality rating.
// British-male voices are listed first since that's the "Jarvis" ask, but
// the full roster is here so the picker isn't artificially narrowed.
export interface TalkVoice {
  id: string;
  label: string;
  grade: string;
}

export const TALK_VOICES: TalkVoice[] = [
  { id: "bm_fable", label: "Fable (British Male)", grade: "C" },
  { id: "bm_george", label: "George (British Male)", grade: "C" },
  { id: "bm_lewis", label: "Lewis (British Male)", grade: "D+" },
  { id: "bm_daniel", label: "Daniel (British Male)", grade: "D" },
  { id: "bf_emma", label: "Emma (British Female)", grade: "B-" },
  { id: "bf_alice", label: "Alice (British Female)", grade: "D" },
  { id: "bf_isabella", label: "Isabella (British Female)", grade: "C" },
  { id: "bf_lily", label: "Lily (British Female)", grade: "D" },
  { id: "af_heart", label: "Heart (American Female)", grade: "A" },
  { id: "af_bella", label: "Bella (American Female)", grade: "A-" },
  { id: "am_michael", label: "Michael (American Male)", grade: "C+" },
  { id: "am_fenrir", label: "Fenrir (American Male)", grade: "C+" },
];

export function isKnownVoice(id: string): boolean {
  return TALK_VOICES.some((v) => v.id === id);
}

// Kokoro's confirmed equal-weight voice blend syntax: join two voice ids
// with "+". Weighted blends exist in principle but the exact ratio syntax
// isn't confirmed in DeepInfra's public docs, so intentionally unsupported
// here rather than shipping something untested.
export function resolveVoiceParam(voice: string, blendVoice: string | null): string {
  if (blendVoice && isKnownVoice(blendVoice) && blendVoice !== voice) {
    return `${voice}+${blendVoice}`;
  }
  return voice;
}
