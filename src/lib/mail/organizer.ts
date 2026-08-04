import Anthropic from "@anthropic-ai/sdk";
import type { gmail_v1 } from "googleapis";
import { logAiUsage } from "@/lib/aiUsageLog";
import { createFolder, refileMessage, type Folder } from "./labels";

const MODEL = "claude-opus-4-8";

export interface InboxMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  // Folders (user labels) the message is actually sitting in right now --
  // empty for a brand-new unfiled message. This is what lets organising
  // become a real move (remove these, add the new ones) instead of only
  // ever piling a label on top.
  currentFolders: Folder[];
  // Whether the message is still sitting in the primary inbox -- INBOX is
  // a system label excluded from currentFolders, so this is tracked
  // separately and used to actually archive it out on filing (Gmail's
  // standard "move to folder" behaviour).
  inInbox: boolean;
}

interface ClassificationResult {
  newFolders: string[];
  assignments: { messageId: string; folders: string[] }[];
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    newFolders: {
      type: "array",
      items: { type: "string" },
      description:
        "Any brand-new folder names to create, only if none of the existing folders genuinely fit. Keep this rare -- reuse an existing folder whenever it's a reasonable fit rather than creating a near-duplicate.",
    },
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          messageId: { type: "string" },
          folders: {
            type: "array",
            items: { type: "string" },
            description: "Folder name(s) for this message -- existing names or ones listed in newFolders. Usually just one; only use more than one if the message genuinely belongs in more than one place.",
          },
        },
        required: ["messageId", "folders"],
        additionalProperties: false,
      },
    },
  },
  required: ["newFolders", "assignments"],
  additionalProperties: false,
};

function buildSystemPrompt(existingFolders: string[]): string {
  return `You are organising Morgan's personal Gmail inbox on his behalf, filing incoming mail into folders (Gmail labels). He runs Reyse, an AI automation business, alongside a 9-5 job, from Harwich, UK.

EXISTING FOLDERS:
${existingFolders.length > 0 ? existingFolders.map((f) => `- ${f}`).join("\n") : "(none yet -- this is the first batch, use your judgement to establish a sensible starting set)"}

RULES:
- Strongly prefer an existing folder over creating a new one. Only propose a new folder when a message genuinely doesn't fit anything existing and represents a real recurring category, not a one-off.
- Keep the folder set broad and tidy, not fragmented -- think "Finance", "Reyse Clients", "Personal", "Receipts", "Newsletters", not a new folder per sender.
- Every message must be assigned to at least one folder.
- Judge from the subject, sender, and snippet given -- don't invent content you can't see.
- This is filing, not summarising or replying -- just decide where each message belongs.`;
}

export async function classifyMessages(
  messages: InboxMessage[],
  existingFolders: string[],
): Promise<ClassificationResult> {
  const client = new Anthropic();

  const userMessage = messages
    .map((m) => `messageId: ${m.id}\nfrom: ${m.from}\nsubject: ${m.subject}\nsnippet: ${m.snippet}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: buildSystemPrompt(existingFolders),
    messages: [{ role: "user", content: `Organise these messages:\n\n${userMessage}` }],
  });

  await logAiUsage({
    feature: "mail-organizer",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Mail organiser returned no text content");
  }
  return JSON.parse(textBlock.text) as ClassificationResult;
}

// Classifies a batch of messages, creates whatever new folders were
// genuinely needed, then refiles every message into place -- the only
// place "full trust, no per-action confirmation" autonomy actually
// happens. Used both by the ongoing new-mail job (messages arrive with no
// currentFolders yet) and the backfill sweep (messages may already be
// sitting somewhere and can genuinely move).
export async function organizeMessages(
  gmail: gmail_v1.Gmail,
  messages: InboxMessage[],
  existingFolders: Folder[],
): Promise<void> {
  if (messages.length === 0) return;

  const result = await classifyMessages(
    messages,
    existingFolders.map((f) => f.name),
  );

  // Keyed by lowercase name -- Claude re-proposing "Finance" one tick and
  // "finance" the next would otherwise create a duplicate folder every
  // time, working directly against "keep everything organised."
  const folderByName = new Map(existingFolders.map((f) => [f.name.toLowerCase(), f]));
  for (const rawName of result.newFolders) {
    const name = rawName.trim();
    if (!name || folderByName.has(name.toLowerCase())) continue;
    const created = await createFolder(gmail, name);
    folderByName.set(name.toLowerCase(), created);
  }

  const messageByid = new Map(messages.map((m) => [m.id, m]));
  for (const assignment of result.assignments) {
    const message = messageByid.get(assignment.messageId);
    if (!message) continue;

    const folders = assignment.folders
      .map((name) => folderByName.get(name.trim().toLowerCase()))
      .filter((f): f is Folder => Boolean(f));
    if (folders.length === 0) continue;

    await refileMessage(gmail, message.id, message.subject, message.currentFolders, folders, message.inInbox);
  }
}
