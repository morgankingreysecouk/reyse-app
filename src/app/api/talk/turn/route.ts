import { NextResponse } from "next/server";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { speak } from "@/lib/talk/speak";

// Needs a real Node process (spawns the Agent SDK's native binary as a
// subprocess), not the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const VAULT_DIR = path.join(process.cwd(), "vault");

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

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
      // reyse-app runs other features (e.g. Instagram automation) that may
      // legitimately need a metered ANTHROPIC_API_KEY of their own. The
      // Agent SDK's credential resolution is environment-based, so rather
      // than requiring the whole app to go without that key, scope it out
      // of just this subprocess -- `env` here fully replaces the spawned
      // process's environment (it doesn't merge with process.env), so
      // spread process.env first and drop only the one key that would
      // otherwise silently override the subscription-based auth.
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
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

export async function POST(request: Request) {
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
    const settings = await db.talkSettings.findUnique({ where: { id: "singleton" } });
    const audioBuffer = await speak(
      reply,
      settings?.voice ?? "bm_lewis",
      settings?.blendVoice ?? null,
      settings?.speed ?? 1.0,
    );

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
