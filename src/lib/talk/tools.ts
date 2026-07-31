import path from "path";
import { readFile, writeFile } from "fs/promises";
import { after } from "next/server";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { queueBackgroundTask, runBackgroundTask } from "@/lib/talk/backgroundTasks";

const VAULT_DIR = path.join(process.cwd(), "vault");
const ACTIVE_PRIORITIES_PATH = path.join(VAULT_DIR, "Active Priorities.md");
const HANDOFF_MARKER = "**[Talk to Rey request — unactioned]**";

const queueBackgroundTaskTool = tool(
  "queue_background_task",
  "Queue a substantial build, research, or writing task to run in the background " +
    "instead of doing it inline in this conversation. Use this whenever Morgan asks " +
    "you to build, create, draft, or research something that would take real " +
    "multi-step work AND is something you can actually do yourself (vault notes, " +
    "research, drafts) -- gather everything you need from him in conversation " +
    "first, and only call this once you have a clear, complete brief and he's " +
    "said to go ahead. Never use this for quick questions, things you can just " +
    "answer or do in this reply, or actual code changes to reyse-app/Reyse-" +
    "Website/reyse-vault -- use handoff_prompt for those instead. After calling " +
    "it, tell Morgan you'll get started and let him know when it's done -- never " +
    "say the task itself is finished, only that it's queued.",
  {
    description: z
      .string()
      .describe(
        "A complete, self-contained brief of the task. It runs in a fresh session " +
          "with no memory of this conversation, so include everything it needs to know.",
      ),
  },
  async ({ description }) => {
    const task = await queueBackgroundTask(description);
    after(() => runBackgroundTask(task.id));
    return {
      content: [
        {
          type: "text" as const,
          text: `Queued as background task ${task.id}. Tell Morgan you're on it and will let him know when it's done.`,
        },
      ],
    };
  },
);

let lastHandoffBrief: { project: string; brief: string } | null = null;

// Reads and clears in one call so a brief is only ever surfaced to the
// frontend once, on the turn it was actually produced.
export function takeLastHandoffBrief(): { project: string; brief: string } | null {
  const brief = lastHandoffBrief;
  lastHandoffBrief = null;
  return brief;
}

const handoffPromptTool = tool(
  "handoff_prompt",
  "Use this when Morgan asks for an actual code change to reyse-app, Reyse-" +
    "Website, or reyse-vault -- you can't build those yourself, you can only " +
    "reach the vault checkout. Gather full requirements conversationally first " +
    "(what should change, why, any constraints), the same way Morgan would " +
    "brief a developer, and only call this once he's said to go ahead. Write " +
    "the brief as a clear, complete, ready-to-hand-to-an-engineer spec -- not " +
    "written for the ear, this gets read and copied, not spoken. After calling " +
    "this, your spoken/typed reply should be short, e.g. \"Brief's queued, I'll " +
    "get it built\" -- never read the brief itself aloud.",
  {
    project: z
      .enum(["reyse-app", "Reyse-Website", "reyse-vault"])
      .describe("Which repo this change belongs to."),
    brief: z
      .string()
      .describe(
        "The complete, ready-to-execute brief: what to change, why, and any " +
          "constraints Morgan mentioned. Written as a real spec, not spoken prose.",
      ),
  },
  async ({ project, brief }) => {
    const existing = await readFile(ACTIVE_PRIORITIES_PATH, "utf8");
    const timestamp = new Date().toISOString().slice(0, 10);
    const entry = `- [ ] ${HANDOFF_MARKER} (${project}, queued ${timestamp} via Talk to Rey) — ${brief.replace(/\n/g, " ")}\n`;
    const marker = "### Open Tasks\n";
    const insertAt = existing.indexOf(marker);
    const updated =
      insertAt === -1
        ? `${existing}\n${entry}`
        : existing.slice(0, insertAt + marker.length) + entry + existing.slice(insertAt + marker.length);
    await writeFile(ACTIVE_PRIORITIES_PATH, updated, "utf8");

    // Not pushed here directly -- the route syncs the whole vault checkout
    // once after the turn finishes, covering this and any other edit made
    // during the same conversation in one commit rather than racing two.
    lastHandoffBrief = { project, brief };

    return {
      content: [
        {
          type: "text" as const,
          text: "Brief queued in Active Priorities. Tell Morgan it's ready and you'll let him know once it's built.",
        },
      ],
    };
  },
);

export const talkToolsServer = createSdkMcpServer({
  name: "talk-tools",
  tools: [queueBackgroundTaskTool, handoffPromptTool],
});
