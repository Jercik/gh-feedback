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

const reactedOn = {
  finding: {
    user: { id: -2 },
    path: "src/a.ts",
    body: "<!-- review:claim:01M71ZA6QAKR3HA7G41W0553BN -->\n**low** — Finding\n\nclaim `01M71ZA6QAKR3HA7G41W0553BN` of review `01M71ZA6QAKR3HA7G41W0553BP`",
  },
  other: undefined,
};

describe("native reaction status", () => {
  it.each<{
    reactions: string[];
    on: keyof typeof reactedOn;
    status: string;
    conflict: boolean;
  }>([
    { reactions: [], on: "other", status: "pending", conflict: false },
    { reactions: ["heart"], on: "other", status: "pending", conflict: false },
    { reactions: ["fire"], on: "other", status: "pending", conflict: false },
    { reactions: ["eyes"], on: "other", status: "in-progress", conflict: false },
    {
      reactions: ["confused", "eyes"],
      on: "other",
      status: "awaiting-reply",
      conflict: false,
    },
    { reactions: ["+1", "confused"], on: "other", status: "agreed", conflict: false },
    { reactions: ["-1"], on: "other", status: "disagreed", conflict: false },
    {
      reactions: ["rocket", "rocket"],
      on: "other",
      status: "acknowledged",
      conflict: false,
    },
    { reactions: ["+1", "rocket"], on: "other", status: "in-progress", conflict: true },
    { reactions: ["hooray"], on: "finding", status: "dismissed", conflict: false },
    { reactions: ["hooray", "-1"], on: "finding", status: "in-progress", conflict: true },
    { reactions: ["hooray"], on: "other", status: "pending", conflict: false },
    { reactions: ["hooray", "-1"], on: "other", status: "disagreed", conflict: false },
  ])("projects $reactions on $on as $status", ({ reactions, on, status, conflict }) => {
    expect(deriveStatus(reactions, reactedOn[on])).toStrictEqual({
      viewerReactions: reactions,
      status,
      conflictingFinalReactions: conflict,
    });
  });
});
