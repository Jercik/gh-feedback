import { describe, expect, it } from "vitest";
import { forgejoResolutionArgs, isForgejoConversationResolvedBy } from "./forgejo-resolution.js";

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
