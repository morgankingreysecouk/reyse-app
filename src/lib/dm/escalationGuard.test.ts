import { describe, expect, it } from "vitest";
import { checkEscalationGuard } from "./escalationGuard";

describe("checkEscalationGuard", () => {
  it("does not escalate an ordinary question", () => {
    const result = checkEscalationGuard("What time is check-in?");
    expect(result.shouldEscalate).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("escalates an explicit request for a human", () => {
    const result = checkEscalationGuard("Can I speak to a real person please");
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toMatch(/speak to a person/i);
  });

  it("escalates a request for the owner/manager", () => {
    const result = checkEscalationGuard("is the owner there right now");
    expect(result.shouldEscalate).toBe(true);
  });

  it("escalates 'speak to the manager' as well as 'speak to a manager'", () => {
    // Regression: the original pattern only allowed an optional "a" before
    // the target word, so "the manager" -- arguably the more common real
    // phrasing -- silently fell through to the AI instead of escalating.
    expect(checkEscalationGuard("I demand to speak to the manager right now").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("can I speak to a manager please").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("let me speak to your manager").shouldEscalate).toBe(true);
  });

  it("escalates refund/legal language", () => {
    expect(checkEscalationGuard("I want a refund immediately").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("I'll be speaking to my solicitor about this").shouldEscalate).toBe(true);
  });

  it("escalates a reported safety issue", () => {
    expect(checkEscalationGuard("There's no hot water in the flat").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("I think I can smell a gas leak").shouldEscalate).toBe(true);
  });

  it("escalates profanity, including inflected forms", () => {
    expect(checkEscalationGuard("this is fucking ridiculous").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("what a shitty experience").shouldEscalate).toBe(true);
  });

  it("does not false-positive on a substring inside an unrelated word", () => {
    // "class" contains no banned substrings, but this guards the general
    // word-boundary behaviour so a future banned word doesn't accidentally
    // match part of a longer, innocent word.
    expect(checkEscalationGuard("the assistant was very classy about it").shouldEscalate).toBe(false);
  });

  it("escalates heavy emphasis combined with negative sentiment", () => {
    const result = checkEscalationGuard("This is UNACCEPTABLE!!! I am furious about this!!!");
    expect(result.shouldEscalate).toBe(true);
  });

  it("does not escalate a single strong word without heavy emphasis", () => {
    const result = checkEscalationGuard("The weather was terrible during our stay but we still loved it");
    expect(result.shouldEscalate).toBe(false);
  });

  it("does not escalate heavy emphasis alone without negative sentiment", () => {
    const result = checkEscalationGuard("This place is AMAZING!!! Best holiday ever!!!");
    expect(result.shouldEscalate).toBe(false);
  });
});
