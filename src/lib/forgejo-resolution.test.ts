import { describe, expect, it } from "vitest";
import {
  decideForgejoCompletion,
  decideForgejoReopen,
  forgejoCompletionNeedsReadiness,
  forgejoResolutionUnsupportedReason,
  forgejoResolutionArgs,
  isForgejoConversationResolvedBy,
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

describe("forgejoResolutionUnsupportedReason", () => {
  it.each([
    "this Forgejo instance has no conversation-resolution API",
    'unknown command "resolve"',
    "Error: unknown flag: --json",
    "accepts 1 arg(s), received 3",
  ])("recognizes a graceful-degrade failure: %s", (message) => {
    expect(forgejoResolutionUnsupportedReason(message)).toBeDefined();
  });

  it.each([
    "connection reset by peer",
    "not allowed to mark this conversation",
    'request failed after remote said unknown command "resolve"',
  ])("does not hide an operational failure: %s", (message) => {
    expect(forgejoResolutionUnsupportedReason(message)).toBeUndefined();
  });
});

describe("forgejoResolutionUnsupportedReason details", () => {
  it("preserves the server capability verdict", () => {
    expect(
      forgejoResolutionUnsupportedReason(
        "this Forgejo instance has no conversation-resolution API",
      ),
    ).toBe("this Forgejo instance has no conversation-resolution API");
  });

  it.each([
    "Error: unknown flag: --json",
    "accepts 1 arg(s), received 3",
    'Error: unknown command "resolve" for "fgj pr review"\nUsage:\n  fgj pr review [flags]',
  ])("explains an outdated fgj build: %s", (message) => {
    expect(forgejoResolutionUnsupportedReason(message)).toBe(
      "installed fgj does not support conversation resolution; install the j4k build v0.5.0-j4k.4 or newer",
    );
  });
});

describe("forgejoCompletionNeedsReadiness", () => {
  it("checks only unresolved thread settlements", () => {
    expect(forgejoCompletionNeedsReadiness(thread, "agreed", false)).toBe(true);
    expect(forgejoCompletionNeedsReadiness(thread, "acknowledged", true)).toBe(false);
    expect(forgejoCompletionNeedsReadiness(thread, "disagreed", false)).toBe(false);
    expect(forgejoCompletionNeedsReadiness({ ...thread, type: "comment" }, "agreed", false)).toBe(
      false,
    );
  });
});

describe("decideForgejoReopen", () => {
  it("reopens only a viewer-owned thread", () => {
    expect(decideForgejoReopen(thread, true, true)).toStrictEqual({ action: "unresolve" });
    expect(decideForgejoReopen(thread, false, false)).toStrictEqual({
      supported: true,
      applied: true,
    });
    expect(decideForgejoReopen(thread, false, true)).toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution belongs to another user and was preserved",
    });
    expect(decideForgejoReopen({ ...thread, type: "comment" }, false, false)).toStrictEqual({
      supported: false,
      reason: "Forgejo has no comment-hide API; status is tracked by reaction only.",
    });
  });
});

describe("decideForgejoCompletion", () => {
  it("reports the reason when shared resolution is deferred", () => {
    expect(
      decideForgejoCompletion(
        thread,
        "agreed",
        false,
        false,
        "conversation resolution deferred until its other findings settle",
      ),
    ).toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution deferred until its other findings settle",
    });
  });

  it("preserves another user's resolution on disagreement", () => {
    expect(decideForgejoCompletion(thread, "disagreed", false, true, undefined)).toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution belongs to another user and was preserved",
    });
  });

  it("treats an already-open disagreement as policy success", () => {
    expect(decideForgejoCompletion(thread, "disagreed", false, false, undefined)).toStrictEqual({
      supported: true,
      applied: true,
    });
  });

  it("treats an already-resolved agreement as policy success", () => {
    expect(decideForgejoCompletion(thread, "agreed", false, true, undefined)).toStrictEqual({
      supported: true,
      applied: true,
    });
  });

  it("reports non-thread completion as unsupported", () => {
    expect(
      decideForgejoCompletion({ ...thread, type: "comment" }, "disagreed", false, false, undefined),
    ).toStrictEqual({
      supported: false,
      reason: "Forgejo has no comment-hide API; status is tracked by reaction only.",
    });
  });

  it("chooses native resolve for a ready open conversation", () => {
    expect(decideForgejoCompletion(thread, "agreed", false, false, undefined)).toStrictEqual({
      action: "resolve",
    });
  });

  it("chooses native unresolve for a viewer-owned disagreement", () => {
    expect(decideForgejoCompletion(thread, "disagreed", true, true, undefined)).toStrictEqual({
      action: "unresolve",
    });
  });
});
