import { afterEach, describe, expect, it, vi } from "vitest";
import { forgejoFetchAll, forgejoFetchReviews } from "./forgejo-cli.js";
import { fetchPullReviewComments } from "./forgejo-pull-review-comments.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0, stdout: "token", stderr: "" })),
}));

function json(body: unknown, count?: string): Response {
  return Response.json(body, {
    headers: count === undefined ? {} : { "X-Total-Count": count },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("forgejo review pagination", () => {
  it("crosses empty and underfilled pages to find published comments without exposing drafts", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ max_response_items: 2 }))
      .mockResolvedValueOnce(json([], "6"))
      .mockResolvedValueOnce(json([{ id: 4, state: "PENDING" }], "6"))
      .mockResolvedValueOnce(json([{ id: 6, state: "COMMENT" }], "6"))
      .mockResolvedValueOnce(json([{ id: 61, body: "Published finding" }]));
    vi.stubGlobal("fetch", fetch);

    const comments = await fetchPullReviewComments("owner/repo", 7);

    expect(comments).toMatchObject([{ id: 61, body: "Published finding" }]);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(fetch.mock.calls[3]?.[0]).toBe(
      "https://code.j4k.dev/api/v1/repos/owner/repo/pulls/7/reviews?page=3&limit=2",
    );
    expect(fetch.mock.calls[4]?.[0]).toBe(
      "https://code.j4k.dev/api/v1/repos/owner/repo/pulls/7/reviews/6/comments",
    );
  });

  it.each([undefined, "", "-1", "1.5", "oops", "9007199254740992"])(
    "rejects invalid count %s",
    async (count) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(json({ max_response_items: 2 }))
          .mockResolvedValueOnce(json([], count)),
      );

      await expect(forgejoFetchReviews("reviews")).rejects.toThrow(
        "missing or invalid X-Total-Count",
      );
    },
  );

  it.each([0, -1, 1.5, "2", null])("rejects invalid instance page limit %s", async (limit) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ max_response_items: limit })));

    await expect(forgejoFetchReviews("reviews")).rejects.toThrow("invalid max_response_items");
  });

  it("bounds pagination even when the count never fits", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ max_response_items: 1 }))
      .mockImplementation(async () => json([], "1001"));
    vi.stubGlobal("fetch", fetch);

    await expect(forgejoFetchReviews("reviews")).rejects.toThrow("exceeded 1000 pages");
    expect(fetch).toHaveBeenCalledTimes(1001);
  });
});

describe("counted pull listing", () => {
  it("requests pages at the instance cap and finds the third record", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ max_response_items: 2 }))
        .mockResolvedValueOnce(json([{ id: 1 }, { id: 2 }], "3"))
        .mockResolvedValueOnce(json([{ id: 3 }], "3")),
    );
    await expect(
      forgejoFetchAll("repos/owner/repo/pulls", { state: "open" }),
    ).resolves.toStrictEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("fails closed when a paginated list has no completeness count", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ max_response_items: 2 }))
        .mockResolvedValueOnce(json([{ id: 1 }])),
    );
    await expect(forgejoFetchAll("repos/owner/repo/pulls")).rejects.toThrow(
      "missing or invalid X-Total-Count",
    );
  });
});
