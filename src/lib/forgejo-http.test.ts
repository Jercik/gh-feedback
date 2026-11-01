import { afterEach, describe, expect, it, vi } from "vitest";
import { forgejoFetch } from "./forgejo-http.js";
import { postForgejoReply } from "./forgejo-reply.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";
import { forgejoFetchReviews } from "./forgejo-cli.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0, stdout: "token", stderr: "" })),
}));

afterEach(() => vi.unstubAllGlobals());

describe("forgejo response bodies", () => {
  it("accepts a successful no-content mutation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(
      forgejoFetch<unknown>({ method: "DELETE", path: "reactions" }),
    ).resolves.toBeUndefined();
  });

  it("retains the empty-body result for other successful statuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(forgejoFetch<unknown>({ path: "settings/api" })).resolves.toBeUndefined();
  });

  it("returns successful JSON unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: 42, html_url: "reply-url" })),
    );
    await expect(
      forgejoFetch<unknown>({ method: "POST", path: "comments" }),
    ).resolves.toStrictEqual({ id: 42, html_url: "reply-url" });
  });

  it("fails a required settings read with its actionable validation error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(forgejoFetchReviews("reviews")).rejects.toThrow(
      "GET settings/api: invalid max_response_items",
    );
  });

  it("identifies an issue reply whose successful response has no JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(
      postForgejoReply(
        "owner/repo",
        { type: "comment", id: 1, author: "reviewer", prNumber: 7, path: null, line: null },
        "Fixed",
        undefined,
      ),
    ).rejects.toThrow(
      "Forgejo POST repos/owner/repo/issues/7/comments: missing JSON reply response; the reply may already exist",
    );
  });

  it("identifies a threaded reply whose successful response has no JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(
      postForgejoReply(
        "owner/repo",
        { type: "thread", id: 1, author: "reviewer", prNumber: 7, path: "file.ts", line: 4 },
        "Fixed",
        ForgejoReviewComment.parse({
          id: 1,
          pull_request_review_id: 3,
          path: "file.ts",
          position: 4,
          original_position: 0,
        }),
      ),
    ).rejects.toThrow(
      "Forgejo POST repos/owner/repo/pulls/7/reviews/3/comments: missing JSON reply response; the reply may already exist",
    );
  });
});
