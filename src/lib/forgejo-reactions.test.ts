import { deriveStatus } from "./feedback-values.js";
import { describe, it, expect } from "vitest";
import { viewerReactionStrings, reactionsPath } from "./forgejo-reactions.js";

describe("reactionsPath", () => {
  it("routes inline review comments through the shared issue-comments endpoint", () => {
    expect(reactionsPath("j4k/cluster", 42)).toBe("repos/j4k/cluster/issues/comments/42/reactions");
  });

  it("routes PR issue comments through the issue-comments endpoint", () => {
    expect(reactionsPath("j4k/cluster", 7)).toBe("repos/j4k/cluster/issues/comments/7/reactions");
  });

  it("uses the native backing comment reaction endpoint for reviews", () => {
    expect(reactionsPath("j4k/cluster", 1)).toBe("repos/j4k/cluster/issues/comments/1/reactions");
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
    expect(result).toStrictEqual(["+1", "eyes"]);
  });
});

describe("native reaction status", () => {
  it.each([
    { reactions: [], status: "pending", conflict: false },
    { reactions: ["heart"], status: "pending", conflict: false },
    { reactions: ["fire"], status: "pending", conflict: false },
    { reactions: ["eyes"], status: "in-progress", conflict: false },
    { reactions: ["confused", "eyes"], status: "awaiting-reply", conflict: false },
    { reactions: ["+1", "confused"], status: "agreed", conflict: false },
    { reactions: ["-1"], status: "disagreed", conflict: false },
    { reactions: ["rocket", "rocket"], status: "acknowledged", conflict: false },
    { reactions: ["+1", "rocket"], status: "in-progress", conflict: true },
  ])("projects $reactions as $status", ({ reactions, status, conflict }) => {
    expect(deriveStatus(reactions)).toStrictEqual({
      viewerReactions: reactions,
      status,
      conflictingFinalReactions: conflict,
    });
  });
});
