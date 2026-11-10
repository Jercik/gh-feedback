import { deriveStatus } from "./feedback-values.js";
import { describe, it, expect } from "vitest";
import { viewerReactionStrings, reactionsPath } from "./forgejo-reactions.js";

describe("reactionsPath", () => {
  it("uses the native backing comment reaction endpoint", () => {
    expect(reactionsPath("j4k/cluster", 42)).toBe("repos/j4k/cluster/issues/comments/42/reactions");
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
    { reactions: [], dismissible: false, status: "pending", conflict: false },
    { reactions: ["heart"], dismissible: false, status: "pending", conflict: false },
    { reactions: ["fire"], dismissible: false, status: "pending", conflict: false },
    { reactions: ["eyes"], dismissible: false, status: "in-progress", conflict: false },
    {
      reactions: ["confused", "eyes"],
      dismissible: false,
      status: "awaiting-reply",
      conflict: false,
    },
    { reactions: ["+1", "confused"], dismissible: false, status: "agreed", conflict: false },
    { reactions: ["-1"], dismissible: false, status: "disagreed", conflict: false },
    {
      reactions: ["rocket", "rocket"],
      dismissible: false,
      status: "acknowledged",
      conflict: false,
    },
    { reactions: ["+1", "rocket"], dismissible: false, status: "in-progress", conflict: true },
    { reactions: ["hooray"], dismissible: true, status: "dismissed", conflict: false },
    { reactions: ["hooray", "-1"], dismissible: true, status: "in-progress", conflict: true },
    { reactions: ["hooray"], dismissible: false, status: "pending", conflict: false },
    { reactions: ["hooray", "-1"], dismissible: false, status: "disagreed", conflict: false },
  ])(
    "projects $reactions (dismissible $dismissible) as $status",
    ({ reactions, dismissible, status, conflict }) => {
      expect(deriveStatus(reactions, dismissible)).toStrictEqual({
        viewerReactions: reactions,
        status,
        conflictingFinalReactions: conflict,
      });
    },
  );
});
