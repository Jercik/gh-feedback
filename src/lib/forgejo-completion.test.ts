import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ForgejoReactionsModule from "./forgejo-reactions.js";
import { ForgejoReaction, ForgejoReviewComment } from "./forgejo-schemas.js";
import { completeForgejoItem, reopenForgejoItem } from "./forgejo-completion.js";

const mocks = vi.hoisted(() => ({
  changeResolution: vi.fn(),
  fetchComments: vi.fn(),
  fetchReactions: vi.fn(),
  getViewer: vi.fn(),
}));

vi.mock("./change-forgejo-conversation-resolution.js", () => ({
  changeForgejoConversationResolution: mocks.changeResolution,
}));
vi.mock("./forgejo-pull-review-comments.js", () => ({
  fetchPullReviewComments: mocks.fetchComments,
}));
vi.mock("./forgejo-environment.js", () => ({ getForgejoViewer: mocks.getViewer }));
vi.mock("./forgejo-reactions.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ForgejoReactionsModule>()),
  fetchReactions: mocks.fetchReactions,
}));

const thread = {
  type: "thread" as const,
  id: 1,
  author: "reviewer",
  prNumber: 36,
  path: "src/a.ts",
  line: 20,
};

const comment = (overrides: Record<string, unknown> = {}) =>
  ForgejoReviewComment.parse({
    id: 1,
    pull_request_review_id: 7,
    path: "src/a.ts",
    position: 20,
    original_position: 0,
    user: { login: "reviewer" },
    ...overrides,
  });

describe("forgejo transition state refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewer.mockResolvedValue("codex");
    mocks.fetchReactions.mockResolvedValue([]);
    mocks.changeResolution.mockReturnValue({ supported: true, applied: true });
  });

  it("reopens a conversation freshly resolved by the viewer", async () => {
    mocks.fetchComments.mockResolvedValue([comment({ resolver: { login: "codex" } })]);

    await expect(
      completeForgejoItem("Jercik/gh-feedback", thread, "disagreed"),
    ).resolves.toStrictEqual({ supported: true, applied: true });
    expect(mocks.fetchComments).toHaveBeenCalledTimes(1);
    expect(mocks.changeResolution).toHaveBeenCalledWith("Jercik/gh-feedback", 36, 1, "unresolve");
  });

  it("preserves a conversation freshly resolved by another user", async () => {
    mocks.fetchComments.mockResolvedValue([comment({ resolver: { login: "reviewer" } })]);

    await expect(reopenForgejoItem("Jercik/gh-feedback", thread)).resolves.toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution belongs to another user and was preserved",
    });
    expect(mocks.fetchComments).toHaveBeenCalledTimes(1);
    expect(mocks.changeResolution).not.toHaveBeenCalled();
  });

  it("defers resolution for a freshly added unsettled sibling", async () => {
    mocks.fetchComments.mockResolvedValue([comment(), comment({ id: 2 })]);

    await expect(
      completeForgejoItem("Jercik/gh-feedback", thread, "agreed"),
    ).resolves.toStrictEqual({
      supported: true,
      applied: false,
      reason: "conversation resolution deferred until its other findings settle",
    });
    expect(mocks.fetchComments).toHaveBeenCalledTimes(1);
    expect(mocks.fetchReactions).toHaveBeenCalledWith("Jercik/gh-feedback", "review-comment", 2);
    expect(mocks.changeResolution).not.toHaveBeenCalled();
  });

  it("resolves when a freshly added sibling is settled", async () => {
    mocks.fetchComments.mockResolvedValue([comment(), comment({ id: 2 })]);
    mocks.fetchReactions.mockResolvedValue([
      ForgejoReaction.parse({ content: "+1", user: { login: "codex" } }),
    ]);

    await expect(
      completeForgejoItem("Jercik/gh-feedback", thread, "agreed"),
    ).resolves.toStrictEqual({ supported: true, applied: true });
    expect(mocks.fetchComments).toHaveBeenCalledTimes(1);
    expect(mocks.changeResolution).toHaveBeenCalledWith("Jercik/gh-feedback", 36, 1, "resolve");
  });

  it("does not fetch review comments for a plain comment", async () => {
    await expect(
      completeForgejoItem("Jercik/gh-feedback", { ...thread, type: "comment" }, "acknowledged"),
    ).resolves.toStrictEqual({
      supported: false,
      reason: "Forgejo has no comment-hide API; status is tracked by reaction only.",
    });
    expect(mocks.fetchComments).not.toHaveBeenCalled();
  });
});
