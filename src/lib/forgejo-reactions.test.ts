import { describe, it, expect } from "vitest";
import {
  normalizeForgejoReactions,
  viewerReactionStrings,
  reactionsPath,
} from "./forgejo-reactions.js";

describe("reactionsPath", () => {
  it("routes inline review comments through the shared issue-comments endpoint", () => {
    expect(reactionsPath("j4k/cluster", "review-comment", 42)).toBe(
      "repos/j4k/cluster/issues/comments/42/reactions",
    );
  });

  it("routes PR issue comments through the issue-comments endpoint", () => {
    expect(reactionsPath("j4k/cluster", "issue-comment", 7)).toBe(
      "repos/j4k/cluster/issues/comments/7/reactions",
    );
  });

  it("has no reaction endpoint for reviews", () => {
    expect(reactionsPath("j4k/cluster", "review", 1)).toBeUndefined();
  });
});

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
