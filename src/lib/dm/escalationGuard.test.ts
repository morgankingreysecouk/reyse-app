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

  // Highest-priority category -- checked first in TRIGGERS so its reason
  // wins even if a message happens to also match something else.
  it("escalates crisis/self-harm language", () => {
    expect(checkEscalationGuard("I want to kill myself").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("honestly I just don't want to be here anymore").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("thinking about self harm").shouldEscalate).toBe(true);
    const result = checkEscalationGuard("I've been feeling suicidal lately");
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toMatch(/mental health crisis/i);
  });

  it("does not false-positive crisis language on an unrelated use of 'die' or 'end'", () => {
    expect(checkEscalationGuard("What time does the tour end?").shouldEscalate).toBe(false);
    expect(checkEscalationGuard("Dying to see the sea view from the balcony!").shouldEscalate).toBe(false);
  });

  it("escalates additional human-request phrasings", () => {
    expect(checkEscalationGuard("Can I get someone from your team to call me").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("is there someone I can call about this").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("can a human help me with this booking").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("I don't want to talk to a bot, get me a person").shouldEscalate).toBe(true);
  });

  it("does not over-match innocuous uses of 'team' or 'call'", () => {
    expect(checkEscalationGuard("Your team was amazing during our stay!").shouldEscalate).toBe(false);
    expect(checkEscalationGuard("Should I call ahead before arriving?").shouldEscalate).toBe(false);
  });

  it("escalates British-specific profanity", () => {
    expect(checkEscalationGuard("this place is an absolute bollocks situation").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("what a wanker").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("you're a total twat").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("I am so pissed off right now").shouldEscalate).toBe(true);
  });

  it("does not escalate mild British phrasing deliberately kept off the list", () => {
    expect(checkEscalationGuard("bloody love this place, thanks!").shouldEscalate).toBe(false);
    expect(checkEscalationGuard("don't bugger about with the check-in time please").shouldEscalate).toBe(false);
  });

  it("escalates a damage or deposit dispute", () => {
    expect(checkEscalationGuard("Why has my security deposit not been returned?").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("You're charging my damage deposit for something I didn't do").shouldEscalate).toBe(true);
  });

  it("does not over-match a bare mention of 'damage' with nothing else", () => {
    // Deliberately narrow to the compound phrases above -- "no damage to
    // report" or "is there any damage" are ordinary, non-disputed guest
    // messages that shouldn't escalate on the word alone.
    expect(checkEscalationGuard("Just to let you know, no damage to report, place was perfect!").shouldEscalate).toBe(false);
  });

  it("escalates noise/neighbour/police involvement", () => {
    expect(checkEscalationGuard("the police were called because of the noise last night").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("our neighbours complained about the party").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("we got a noise complaint from next door").shouldEscalate).toBe(true);
  });

  it("escalates a review or reporting threat", () => {
    expect(checkEscalationGuard("I will leave a 1 star review if this isn't sorted").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("I'm going to report you if this happens again").shouldEscalate).toBe(true);
  });

  it("escalates a cancellation request", () => {
    expect(checkEscalationGuard("I need to cancel my booking").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("can I cancel the reservation please").shouldEscalate).toBe(true);
    expect(checkEscalationGuard("we want to cancel unfortunately").shouldEscalate).toBe(true);
  });
});
