import { describe, it, expect } from "vitest";
import { normalizeForgejoReactions, viewerReactionStrings } from "./forgejo-reactions.js";

describe("normalizeForgejoReactions", () => {
  it("maps raw reaction strings to GraphQL enum names", () => {
    const result = normalizeForgejoReactions(
      [
        { content: "+1", user: { login: "alice" } },
        { content: "rocket", user: { login: "bob" } },
      ],
      "carol",
    );
    expect(result).toEqual([
      { content: "THUMBS_UP", viewerHasReacted: false },
      { content: "ROCKET", viewerHasReacted: false },
    ]);
  });

  it("marks viewerHasReacted when the reaction is the viewer's", () => {
    const result = normalizeForgejoReactions(
      [{ content: "+1", user: { login: "alice" } }],
      "alice",
    );
    expect(result).toEqual([{ content: "THUMBS_UP", viewerHasReacted: true }]);
  });

  it("drops reactions outside the known set", () => {
    const result = normalizeForgejoReactions(
      [{ content: "fire", user: { login: "alice" } }],
      "alice",
    );
    expect(result).toEqual([]);
  });
});

describe("viewerReactionStrings", () => {
  it("returns only the viewer's reactions as CLI strings", () => {
    const result = viewerReactionStrings(
      [
        { content: "+1", user: { login: "alice" } },
        { content: "rocket", user: { login: "bob" } },
        { content: "eyes", user: { login: "alice" } },
      ],
      "alice",
    );
    expect(result).toEqual(["+1", "eyes"]);
  });
});
