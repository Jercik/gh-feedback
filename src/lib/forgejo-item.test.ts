import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveItemMeta } from "./forgejo-item.js";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), reviews: vi.fn(), comments: vi.fn() }));
vi.mock("./forgejo-cli.js", () => ({
  forgejoFetch: mocks.fetch,
  forgejoFetchAll: mocks.reviews,
  isForgejoNotFound: () => false,
}));
vi.mock("./forgejo-pull-review-comments.js", () => ({
  fetchPullReviewComments: mocks.comments,
}));

describe("review body action identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetch.mockResolvedValue(undefined);
    mocks.comments.mockResolvedValue([]);
    mocks.reviews.mockResolvedValue([
      {
        id: 17,
        state: "APPROVED",
        body: "Looks good",
        html_url: "https://code.j4k.dev/o/r/pulls/3#issuecomment-91",
      },
      {
        id: 91,
        state: "COMMENTED",
        body: "Different review",
        html_url: "https://code.j4k.dev/o/r/pulls/3#issuecomment-92",
      },
    ]);
  });

  it("selects the backing comment rather than a colliding review entity ID", async () => {
    const resolved = await resolveItemMeta("o/r", 3, 91);
    expect(resolved?.meta.kind).toBe("review");
    expect(resolved?.meta.review?.id).toBe(17);
    expect(resolved?.review?.body).toBe("Looks good");
    expect(mocks.reviews).toHaveBeenCalledWith("repos/o/r/pulls/3/reviews");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not accept a numeric review ID as an action ID", async () => {
    await expect(resolveItemMeta("o/r", 3, 17)).resolves.toBeUndefined();
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith({ path: "repos/o/r/issues/comments/17" });
  });

  it("does not act on a pending review even if it carries an anchor", async () => {
    mocks.reviews.mockResolvedValue([
      { id: 17, state: "PENDING", html_url: "https://code.j4k.dev/o/r/pulls/3#issuecomment-91" },
    ]);
    await expect(resolveItemMeta("o/r", 3, 91)).resolves.toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not invent a backing comment for an unanchored review", async () => {
    mocks.reviews.mockResolvedValue([
      { id: 91, state: "COMMENTED", html_url: "https://code.j4k.dev/o/r/pulls/3" },
    ]);
    await expect(resolveItemMeta("o/r", 3, 91)).resolves.toBeUndefined();
  });

  it("rejects a plain comment belonging to another PR", async () => {
    mocks.reviews.mockResolvedValue([]);
    mocks.fetch.mockResolvedValue({
      id: 91,
      pull_request_url: "https://code.j4k.dev/api/v1/repos/o/r/pulls/4",
    });
    await expect(resolveItemMeta("o/r", 3, 91)).resolves.toBeUndefined();
  });
});
