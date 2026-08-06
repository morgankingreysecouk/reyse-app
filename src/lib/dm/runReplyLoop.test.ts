import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolUnion } from "@anthropic-ai/sdk/resources/messages";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

vi.mock("@/lib/aiUsageLog", () => ({
  logAiUsage: vi.fn(),
}));

// Imported after the mocks above so replyEngine.ts's `new Anthropic()` picks
// up the mocked class, and its `logAiUsage` calls don't try to hit a real DB.
const { runReplyLoop, ESCALATE_TOOL } = await import("./replyEngine");

const CHECK_AVAILABILITY_TOOL: ToolUnion = {
  name: "check_availability",
  description: "test tool",
  input_schema: { type: "object", properties: {} },
};

interface CapturedToolResultContent {
  type: string;
  content?: string;
}
interface CapturedMessage {
  role: string;
  content: string | CapturedToolResultContent[];
}
interface CapturedCallArgs {
  messages: CapturedMessage[];
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("runReplyLoop", () => {
  it("returns the final text when the model replies without any tool call", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Check-in is from 3pm." }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await runReplyLoop({
      clientId: "client-1",
      systemPrompt: "system",
      turns: [{ role: "user", content: "what time is check in" }],
      tools: [ESCALATE_TOOL],
      executors: {},
    });

    expect(result.replyText).toBe("Check-in is from 3pm.");
    expect(result.escalationReason).toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("stays terminal on escalate_to_human even with accompanying text in the same turn", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Let me check on that for you." },
        { type: "tool_use", id: "tool_1", name: "escalate_to_human", input: { reason: "Needs a human" } },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await runReplyLoop({
      clientId: "client-1",
      systemPrompt: "system",
      turns: [{ role: "user", content: "let me speak to someone" }],
      tools: [ESCALATE_TOOL],
      executors: {},
    });

    expect(result.escalationReason).toBe("Needs a human");
    expect(result.replyText).toBe("Let me check on that for you.");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("executes a non-terminal tool, feeds the result back, and continues to a final answer -- the actual behaviour that used to just stop before this rework", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tool_1", name: "check_availability", input: { startDate: "2026-09-01", endDate: "2026-09-03" } },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Those dates are free!" }],
        usage: { input_tokens: 8, output_tokens: 4 },
      });

    const executor = vi.fn().mockResolvedValue("free");
    const result = await runReplyLoop({
      clientId: "client-1",
      systemPrompt: "system",
      turns: [{ role: "user", content: "is 1-3 sept free" }],
      tools: [ESCALATE_TOOL, CHECK_AVAILABILITY_TOOL],
      executors: { check_availability: executor },
    });

    expect(executor).toHaveBeenCalledWith({ startDate: "2026-09-01", endDate: "2026-09-03" });
    expect(result.replyText).toBe("Those dates are free!");
    expect(result.escalationReason).toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const secondCallArgs = mockCreate.mock.calls[1][0] as CapturedCallArgs;
    const toolResultMessage = secondCallArgs.messages.find(
      (m) => m.role === "user" && Array.isArray(m.content) && m.content[0]?.type === "tool_result",
    );
    expect(toolResultMessage).toBeDefined();
    const content = toolResultMessage!.content as CapturedToolResultContent[];
    expect(content[0].content).toBe("free");
  });

  it("escalates when the tool-round budget is exhausted without ever reaching a final text reply", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "tool_x", name: "check_availability", input: {} }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const result = await runReplyLoop({
      clientId: "client-1",
      systemPrompt: "system",
      turns: [{ role: "user", content: "keep checking" }],
      tools: [ESCALATE_TOOL, CHECK_AVAILABILITY_TOOL],
      executors: { check_availability: () => "still checking" },
    });

    expect(result.escalationReason).toBe("Couldn't resolve within the tool-call budget");
  });

  it("turns a throwing executor into an error tool_result instead of crashing the loop", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "check_availability", input: {} }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Sorry, those dates aren't available." }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

    const result = await runReplyLoop({
      clientId: "client-1",
      systemPrompt: "system",
      turns: [{ role: "user", content: "book it" }],
      tools: [ESCALATE_TOOL, CHECK_AVAILABILITY_TOOL],
      executors: {
        check_availability: () => {
          throw new Error("Dates no longer available");
        },
      },
    });

    expect(result.replyText).toBe("Sorry, those dates aren't available.");
    const secondCallArgs = mockCreate.mock.calls[1][0] as CapturedCallArgs;
    const toolResultMessage = secondCallArgs.messages.find((m) => m.role === "user" && Array.isArray(m.content));
    const content = toolResultMessage!.content as CapturedToolResultContent[];
    expect(content[0].content).toContain("Dates no longer available");
  });
});
