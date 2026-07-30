import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import type { BackgroundTask } from "@/generated/prisma/client";

const VAULT_DIR = path.join(process.cwd(), "vault");

// Same spoken-discipline instruction the live conversation uses, plus the
// background-task convention itself -- a fresh session has no memory of the
// live conversation, so it needs the full brief in the prompt, not context.
const BACKGROUND_TASK_SYSTEM_NOTE = `
You're carrying out a task that Rey queued from a voice conversation with
Morgan, running with no memory of that conversation -- work only from the
brief given to you. This runs in the background, not spoken aloud, so write
normally (not for the ear). You're scoped to the reyse-vault checkout only --
no access to the reyse-app/Reyse-Website source code from here.
`;

export async function queueBackgroundTask(prompt: string): Promise<BackgroundTask> {
  return db.backgroundTask.create({ data: { prompt } });
}

// Runs one queued task to completion. Called from within next/server's
// after(), so the HTTP response for the voice turn that queued it doesn't
// wait on this -- Railway's persistent Node process keeps it running
// regardless of how long it takes.
export async function runBackgroundTask(taskId: string): Promise<void> {
  // Runs entirely inside after() with nothing awaiting it -- an uncaught
  // rejection here would be unhandled on a persistent process that also
  // serves the live conversation and the social scheduler, so every DB call
  // and the query() call itself are covered by one top-level catch.
  let sessionId: string | undefined;
  try {
    await db.backgroundTask.update({ where: { id: taskId }, data: { status: "RUNNING" } });
    const task = await db.backgroundTask.findUniqueOrThrow({ where: { id: taskId } });

    let resultText = "";
    for await (const message of query({
      prompt: `${BACKGROUND_TASK_SYSTEM_NOTE}\n\nTask: ${task.prompt}`,
      options: {
        cwd: VAULT_DIR,
        systemPrompt: { type: "preset", preset: "claude_code" },
        // Headless, no human to approve tool use -- see the matching note
        // in api/talk/turn/route.ts's think(). Same vault-only blast radius.
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
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

    await db.backgroundTask.update({
      where: { id: taskId },
      data: { status: "DONE", sessionId, resultSummary: resultText, completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    try {
      await db.backgroundTask.update({
        where: { id: taskId },
        data: { status: "FAILED", sessionId, error: message, completedAt: new Date() },
      });
    } catch (dbErr) {
      console.error(`Background task ${taskId} failed and couldn't be marked FAILED:`, message, dbErr);
    }
  }
}

// Finds tasks that finished since they were last checked and marks them
// reported in the same call, so a later turn doesn't mention them twice.
export async function claimUnreportedFinishedTasks(): Promise<BackgroundTask[]> {
  const tasks = await db.backgroundTask.findMany({
    where: { status: { in: ["DONE", "FAILED"] }, reportedAt: null },
    orderBy: { completedAt: "asc" },
  });
  if (tasks.length === 0) return tasks;

  await db.backgroundTask.updateMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    data: { reportedAt: new Date() },
  });
  return tasks;
}
