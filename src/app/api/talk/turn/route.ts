import { NextResponse } from "next/server";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { speak } from "@/lib/talk/speak";
import { talkToolsServer } from "@/lib/talk/tools";
import { claimUnreportedFinishedTasks } from "@/lib/talk/backgroundTasks";

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

You have a queue_background_task tool for substantial build/research/writing
work. Gather what you need from Morgan in conversation first; only queue once
you have a clear brief and he's said to go ahead. Never claim a queued task is
finished -- only that you're on it.

A message may start with a bracketed note like "[Background task finished:
...]" before Morgan's actual words. That's real system information about a
task you queued earlier, not something Morgan said -- don't treat it as a
question to answer. Mention it briefly and naturally, then respond to what
Morgan actually said after it.
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
  const finishedTasks = await claimUnreportedFinishedTasks();
  const prompt =
    finishedTasks.length === 0
      ? userText
      : `${finishedTasks
          .map((t) =>
            t.status === "DONE"
              ? `[Background task finished: "${t.prompt}" -- result: ${t.resultSummary}]`
              : `[Background task failed: "${t.prompt}" -- error: ${t.error}]`,
          )
          .join("\n")}\n\n${userText}`;

  let resultText = "";
  for await (const message of query({
    prompt,
    options: {
      cwd: VAULT_DIR,
      systemPrompt: { type: "preset", preset: "claude_code", append: SPOKEN_DISCIPLINE },
      mcpServers: { "talk-tools": talkToolsServer },
      // No human is available here to approve tool use (unlike an
      // interactive Claude Code session) -- without this, every tool call,
      // including the built-in vault Read/Write ones, gets silently denied
      // by the default permission mode. Confirmed by testing directly:
      // the queue_background_task tool call came back denied until this
      // was added. Blast radius is limited to the vault checkout (cwd
      // above), which Rey already has standing permission to edit freely.
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
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

// Session check is belt-and-braces here especially -- this route runs a
// full Agent SDK session with bypassPermissions against the real vault
// checkout, driven by nothing but an audio upload.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
