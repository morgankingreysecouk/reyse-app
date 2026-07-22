import { resolveVoiceParam } from "@/lib/talk/voices";

const DEEPINFRA_TTS_URL = "https://api.deepinfra.com/v1/openai/audio/speech";

export async function speak(text: string, voice: string, blendVoice: string | null, speed: number): Promise<Buffer> {
  const res = await fetch(DEEPINFRA_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "hexgrad/Kokoro-82M",
      input: text,
      voice: resolveVoiceParam(voice, blendVoice),
      speed,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`Speaking failed: DeepInfra returned ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
