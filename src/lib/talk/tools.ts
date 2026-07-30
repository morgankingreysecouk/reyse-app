import { after } from "next/server";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { queueBackgroundTask, runBackgroundTask } from "@/lib/talk/backgroundTasks";

const queueBackgroundTaskTool = tool(
  "queue_background_task",
  "Queue a substantial build, research, or writing task to run in the background " +
    "instead of doing it inline in this conversation. Use this whenever Morgan asks " +
    "you to build, create, draft, or research something that would take real " +
    "multi-step work -- gather everything you need from him in conversation first, " +
    "and only call this once you have a clear, complete brief and he's said to go " +
    "ahead. Never use this for quick questions or things you can just answer or do " +
    "in this reply. After calling it, tell Morgan you'll get started and let him " +
    "know when it's done -- never say the task itself is finished, only that it's " +
    "queued.",
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

export const talkToolsServer = createSdkMcpServer({
  name: "talk-tools",
  tools: [queueBackgroundTaskTool],
});
