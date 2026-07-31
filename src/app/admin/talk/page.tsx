"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, Send, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TalkState = "idle" | "listening" | "thinking" | "speaking";
type HandoffBrief = { project: string; brief: string };

const STATE_LABEL: Record<TalkState, string> = {
  idle: "Hold to talk, or type below",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

// Plain module-level function, not a hook -- shared by the voice and typed
// paths, both of which just await it with their own refs/setters. Keeping
// the ref mutation here (outside any useCallback body) avoids the React
// Compiler flagging "modifying a value passed as a hook argument".
async function playTurnResponse(
  res: Response,
  audioElRef: React.RefObject<HTMLAudioElement | null>,
  setTranscript: (v: string) => void,
  setReply: (v: string) => void,
  setHandoffBrief: (v: HandoffBrief | null) => void,
  setState: (v: TalkState) => void,
) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");

  setTranscript(data.transcript);
  setReply(data.reply);
  setHandoffBrief(data.handoffBrief ?? null);

  const audioEl = audioElRef.current ?? new Audio();
  audioElRef.current = audioEl;
  audioEl.src = `data:audio/mpeg;base64,${data.audio}`;
  audioEl.onended = () => setState("idle");
  setState("speaking");
  await audioEl.play();
}

export default function TalkPage() {
  const [state, setState] = useState<TalkState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [handoffBrief, setHandoffBrief] = useState<HandoffBrief | null>(null);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const heldRef = useRef(false);

  const stopPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (heldRef.current) return;
    heldRef.current = true;

    // Holding again while Rey is speaking interrupts playback -- the server-
    // side generation isn't cancelled (that needs a persistent connection,
    // not a one-shot request), only local audio and the next recording.
    if (state === "speaking") {
      stopPlayback();
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("listening");
    } catch {
      heldRef.current = false;
      setError("Couldn't access the microphone -- check the browser's mic permission for this page.");
    }
  }, [state, stopPlayback]);

  const stopRecording = useCallback(() => {
    if (!heldRef.current) return;
    heldRef.current = false;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setState("idle");
      return;
    }

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setState("thinking");
      try {
        const form = new FormData();
        form.append("audio", blob, "turn.webm");
        const res = await fetch("/api/talk/turn", { method: "POST", body: form });
        await playTurnResponse(res, audioElRef, setTranscript, setReply, setHandoffBrief, setState);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState("idle");
      }
    };
    recorder.stop();
  }, []);

  const sendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || state === "thinking") return;

    if (state === "speaking") stopPlayback();

    setError(null);
    setTextInput("");
    setState("thinking");
    try {
      const res = await fetch("/api/talk/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      await playTurnResponse(res, audioElRef, setTranscript, setReply, setHandoffBrief, setState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }, [textInput, state, stopPlayback]);

  const copyBrief = useCallback(() => {
    if (!handoffBrief) return;
    navigator.clipboard.writeText(handoffBrief.brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [handoffBrief]);

  return (
    <div className="h-full flex items-center justify-center">
      <Card className="max-w-md w-full text-center px-8 py-10">
        <button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={() => heldRef.current && stopRecording()}
          onTouchStart={(e) => {
            e.preventDefault();
            startRecording();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopRecording();
          }}
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border transition-colors select-none ${
            state === "listening"
              ? "bg-accent/20 border-accent text-accent"
              : state === "thinking"
                ? "bg-indigo/20 border-indigo text-indigo animate-pulse"
                : state === "speaking"
                  ? "bg-accent/30 border-accent text-accent animate-pulse"
                  : "bg-indigo/10 border-indigo/30 text-indigo"
          }`}
        >
          <Mic size={28} />
        </button>
        <h2 className="font-display text-lg font-semibold text-ink mb-1.5">
          Talk to Rey
        </h2>
        <p className="text-sm text-ink-muted leading-relaxed mb-4">
          {STATE_LABEL[state]}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendText();
          }}
          className="flex gap-2 mb-4"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a message..."
            disabled={state === "thinking"}
            className="flex-1 h-10 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo disabled:opacity-50"
          />
          <Button type="submit" size="md" disabled={!textInput.trim() || state === "thinking"}>
            <Send size={16} />
          </Button>
        </form>

        {transcript && (
          <p className="text-xs text-ink-faint mb-1">You: {transcript}</p>
        )}
        {reply && <p className="text-xs text-ink-muted">Rey: {reply}</p>}
        {error && <p className="text-xs text-danger mt-2">{error}</p>}

        {handoffBrief && (
          <div className="mt-4 text-left rounded-md border border-border-strong bg-surface-raised p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Build brief -- {handoffBrief.project}
              </span>
              <Button variant="secondary" size="sm" onClick={copyBrief}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-ink whitespace-pre-wrap">{handoffBrief.brief}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
