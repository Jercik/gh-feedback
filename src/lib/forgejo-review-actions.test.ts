import { beforeEach, expect, test, vi } from "vitest";
import { createForgejoBackend } from "./forgejo-backend.js";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), reviews: vi.fn(), comments: vi.fn() }));
vi.mock("./forgejo-cli.js", () => ({
  forgejoFetch: mocks.fetch,
  forgejoFetchAll: mocks.reviews,
  forgejoFetchList: vi.fn().mockResolvedValue([]),
  isForgejoNotFound: () => false,
}));
vi.mock("./forgejo-environment.js", () => ({
  getForgejoViewer: vi.fn().mockResolvedValue("codex"),
  findForgejoPullByBranch: vi.fn().mockResolvedValue({ number: 3 }),
}));
vi.mock("./forgejo-pull-review-comments.js", () => ({ fetchPullReviewComments: mocks.comments }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reviews.mockResolvedValue([
    {
      id: 17,
      state: "APPROVED",
      body: "Looks good",
      user: { login: "reviewer" },
      html_url: "https://code.j4k.dev/o/r/pulls/3#issuecomment-91",
    },
  ]);
  mocks.fetch.mockResolvedValue({ id: 100, html_url: "reply-url" });
});

test("mutates the backing comment and replies using its action identity", async () => {
  const backend = createForgejoBackend("o/r");
  const item = await backend.detectItem(91);
  expect(item).toStrictEqual({
    type: "review",
    id: 91,
    author: "reviewer",
    prNumber: 3,
    path: null,
    line: null,
  });
  await backend.addReaction(item, "+1");
  expect(mocks.fetch).toHaveBeenCalledWith({
    method: "POST",
    path: "repos/o/r/issues/comments/91/reactions",
    body: { content: "+1" },
  });
  await backend.reply(item, "Fixed");
  expect(mocks.fetch).toHaveBeenCalledWith({
    method: "POST",
    path: "repos/o/r/issues/3/comments",
    body: { body: "> Replying to review #91\n\nFixed" },
  });
  await expect(backend.complete(item, "agreed")).resolves.toBeUndefined();
  expect(mocks.comments).not.toHaveBeenCalled();
});

test("returns published review state and reactions in detail under the backing ID", async () => {
  mocks.fetch.mockResolvedValue([{ content: "+1", user: { login: "codex" } }]);
  const detail = await createForgejoBackend("o/r").fetchItemDetail(91);
  expect(detail).toStrictEqual({
    type: "review",
    id: 91,
    author: "reviewer",
    state: "APPROVED",
    body: "Looks good",
    submittedAt: "",
    url: "https://code.j4k.dev/o/r/pulls/3#issuecomment-91",
    reactions: [{ content: "+1", count: 1, users: ["codex"], viewerHasReacted: false }],
  });
  expect(mocks.fetch).toHaveBeenCalledWith({ path: "repos/o/r/issues/comments/91/reactions" });
});
