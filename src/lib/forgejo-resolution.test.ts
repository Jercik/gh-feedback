import { describe, expect, it } from "vitest";
import {
  completeForgejoOutcome,
  forgejoResolutionArgs,
  isForgejoConversationResolvedBy,
  isForgejoResolutionUnsupported,
} from "./forgejo-resolution.js";

const thread = {
  type: "thread" as const,
  id: 25_226,
  author: "reviewer",
  prNumber: 160,
  path: "src/a.ts",
  line: 20,
};

describe("forgejoResolutionArgs", () => {
  it("builds the native resolve command", () => {
    expect(
      forgejoResolutionArgs("resolve", "code.j4k.dev", "j4k/cluster", 160, 25_226),
    ).toStrictEqual([
      "--hostname",
      "code.j4k.dev",
      "pr",
      "review",
      "resolve",
      "160",
      "25226",
      "-R",
      "j4k/cluster",
      "--json",
    ]);
  });

  it("builds the native unresolve command", () => {
    expect(
      forgejoResolutionArgs("unresolve", "code.j4k.dev", "j4k/cluster", 160, 25_226),
    ).toStrictEqual([
      "--hostname",
      "code.j4k.dev",
      "pr",
      "review",
      "unresolve",
      "160",
      "25226",
      "-R",
      "j4k/cluster",
      "--json",
    ]);
  });
});

describe("isForgejoConversationResolvedBy", () => {
  it("allows the resolver to reopen their conversation", () => {
    expect(isForgejoConversationResolvedBy({ login: "codex" }, "codex")).toBe(true);
  });

  it("preserves a conversation another user resolved", () => {
    expect(isForgejoConversationResolvedBy({ login: "reviewer" }, "codex")).toBe(false);
  });
});

describe("isForgejoResolutionUnsupported", () => {
  it.each([
    "this Forgejo instance has no conversation-resolution API",
    'unknown command "resolve"',
    "Error: unknown flag: --json",
    "accepts 1 arg(s), received 3",
  ])("recognizes a graceful-degrade failure: %s", (message) => {
    expect(isForgejoResolutionUnsupported(message)).toBe(true);
  });

  it.each([
    "connection reset by peer",
    "not allowed to mark this conversation",
    'request failed after remote said unknown command "resolve"',
  ])("does not hide an operational failure: %s", (message) => {
    expect(isForgejoResolutionUnsupported(message)).toBe(false);
  });
});

describe("completeForgejoOutcome", () => {
  it("reports the reason when shared resolution is deferred", () => {
    expect(
      completeForgejoOutcome("j4k/cluster", thread, "agreed", false, false, false),
    ).toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution deferred until its other findings settle",
    });
  });

  it("preserves another user's resolution on disagreement", () => {
    expect(
      completeForgejoOutcome("j4k/cluster", thread, "disagreed", false, true, true),
    ).toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution belongs to another user and was preserved",
    });
  });

  it("reports non-thread completion as unsupported", () => {
    expect(
      completeForgejoOutcome(
        "j4k/cluster",
        { ...thread, type: "comment" },
        "disagreed",
        false,
        false,
        true,
      ),
    ).toStrictEqual({
      supported: false,
      reason: "Forgejo has no comment-hide API; status is tracked by reaction only.",
    });
  });
});
