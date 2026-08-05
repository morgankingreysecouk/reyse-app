import { describe, expect, it } from "vitest";
import { buildDisambiguationQuestion, matchProperty } from "./replyEngine";

const PROPERTIES = [
  { id: "prop-1", name: "Rose Cottage", location: "Harwich" },
  { id: "prop-2", name: "Harbour Flat", location: "Dovercourt" },
];

describe("matchProperty", () => {
  it("matches on the full property name", () => {
    expect(matchProperty("I'm asking about Rose Cottage", PROPERTIES)?.id).toBe("prop-1");
  });

  it("matches on a meaningful token of the name, case-insensitively", () => {
    expect(matchProperty("is the rose one free next week?", PROPERTIES)?.id).toBe("prop-1");
  });

  it("matches combined with a real question in the same message", () => {
    expect(matchProperty("Rose Cottage, what's check-in?", PROPERTIES)?.id).toBe("prop-1");
  });

  it("returns null when nothing matches", () => {
    expect(matchProperty("I don't know which one", PROPERTIES)).toBeNull();
  });

  it("returns null (ambiguous) rather than guessing when it could plausibly match more than one", () => {
    const ambiguous = [
      { id: "prop-1", name: "Rose Cottage", location: "Harwich" },
      { id: "prop-2", name: "Rose Flat", location: "Dovercourt" },
    ];
    // "Rose" alone is a 4+ char token shared by both -- neither full name
    // is present, so this should resolve to nothing rather than picking one.
    expect(matchProperty("the rose one", ambiguous)).toBeNull();
  });

  it("does not match on short, noisy tokens like 'the' or 'flat'", () => {
    // A generic word shouldn't cause a false match against an unrelated
    // property name once there's more than one candidate in play.
    const multi = [
      { id: "prop-1", name: "The Flat", location: null },
      { id: "prop-2", name: "Meadow House", location: null },
    ];
    expect(matchProperty("just asking about the flat downstairs", multi)?.id).toBe("prop-1");
  });
});

describe("buildDisambiguationQuestion", () => {
  it("lists every property with its location", () => {
    const question = buildDisambiguationQuestion(PROPERTIES);
    expect(question).toContain("Rose Cottage (Harwich)");
    expect(question).toContain("Harbour Flat (Dovercourt)");
  });

  it("omits the parenthetical when a property has no location", () => {
    const question = buildDisambiguationQuestion([{ id: "prop-1", name: "Rose Cottage", location: null }]);
    expect(question).toContain("Rose Cottage");
    expect(question).not.toContain("(");
  });
});
