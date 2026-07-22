import { NextResponse } from "next/server";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Needs a real Node process (spawns the Agent SDK's native binary as a
// subprocess), not the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const VAULT_DIR = path.join(process.cwd(), "vault");

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEEPINFRA_TTS_URL = "https://api.deepinfra.com/v1/openai/audio/speech";

// Everything Rey says here gets spoken aloud through text-to-speech, not
// read as text -- same spoken-discipline instruction voice-line's brain.py
// appends, so replies don't come out as markdown/bullet points read aloud.
const SPOKEN_DISCIPLINE = `
Everything you say in this conversation gets spoken aloud through
text-to-speech, not read as text -- write for the ear: short, conversational
sentences, no markdown, no headings, no code blocks, no bullet points or
numbered lists. Say it the way you'd actually say it out loud.
`;

// One conversation per running server process -- reyse-app has exactly one
// user, so there's no per-request session to juggle.
let sessionId: string | undefined;

async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "utterance.webm");
  form.append("model", "whisper-large-v3-turbo");
  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Hearing you failed: Groq returned ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

async function think(userText: string): Promise<string> {
  let resultText = "";
  for await (const message of query({
    prompt: userText,
    options: {
      cwd: VAULT_DIR,
      systemPrompt: { type: "preset", preset: "claude_code", append: SPOKEN_DISCIPLINE },
      resume: sessionId,
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }
    if ("result" in message && typeof message.result === "string") {
      resultText = message.result;
    }
  }
  return resultText;
}

async function speak(text: string): Promise<Buffer> {
  const res = await fetch(DEEPINFRA_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "hexgrad/Kokoro-82M",
      input: text,
      voice: process.env.VOICE_LINE_KOKORO_VOICE || "bm_lewis",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`Speaking failed: DeepInfra returned ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(request: Request) {
  // Same safety check as voice-line's main.py: an ANTHROPIC_API_KEY anywhere
  // in the environment silently overrides the subscription-based OAuth auth
  // and switches to pay-per-token billing. Refuse rather than let that
  // happen unnoticed.
  if (process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is set on this server -- refusing to run. It would silently switch billing to pay-per-token instead of the subscription. Remove it from Railway's environment variables.",
      },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }

  try {
    const transcript = await transcribe(audio);
    if (!transcript) {
      return NextResponse.json(
        { error: "Didn't catch that -- no speech detected in the recording." },
        { status: 422 },
      );
    }

    const reply = await think(transcript);
    const audioBuffer = await speak(reply);

    return NextResponse.json({
      transcript,
      reply,
      audio: audioBuffer.toString("base64"),
    });
  } catch (err) {
    console.error("Talk turn failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 },
    );
  }
}
