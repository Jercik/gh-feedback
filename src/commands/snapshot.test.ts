import type { SpawnSyncReturns } from "node:child_process";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let checkout: string;
let fgj: string;
beforeAll(() => {
  checkout = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-cli-"));
  fgj = path.join(checkout, "fgj");
  fs.writeFileSync(fgj, "#!/bin/sh\nprintf '%s\\n' fixture-token\n", { mode: 0o755 });
  execFileSync("git", ["init", "--quiet", "--initial-branch=fixture"], { cwd: checkout });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: checkout });
  execFileSync("git", ["config", "user.email", "fixture@example.com"], { cwd: checkout });
  execFileSync(
    "git",
    ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "test: fixture"],
    { cwd: checkout },
  );
  execFileSync("git", ["remote", "add", "origin", "https://code.j4k.dev/owner/repo.git"], {
    cwd: checkout,
  });
}, 120_000);
afterAll(() => {
  fs.rmSync(checkout, { recursive: true, force: true });
});

function run(
  mode = "stable",
  command = ["snapshot", "--repo", "owner/repo", "--pr", "7"],
  standalone = false,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [path.join(repoRoot, "dist/cli.js"), ...command], {
    cwd: standalone ? os.tmpdir() : checkout,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      ...(standalone ? { PATH: "", PR_FEEDBACK_GIT_PATH: "/no-git-for-explicit-snapshot" } : {}),
      PR_FEEDBACK_FGJ_PATH: fgj,
      PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
      SNAPSHOT_FIXTURE_MODE: mode,
      NODE_OPTIONS: `--import=${new URL("fixtures/snapshot-api.test.fixture.ts", import.meta.url).href}`,
    },
  });
}

describe("compiled snapshot CLI", () => {
  it("retains every published surface and nonactionable drafts across underfilled review pages", () => {
    const result = run();
    expect(result.status).toBe(0);
    const snapshot = JSON.parse(result.stdout) as { diagnostics: string[] };
    expect(snapshot).toMatchObject({
      schema: "pr-feedback.snapshot",
      version: 1,
      host: "code.j4k.dev",
      slug: "owner/repo",
      pr: 7,
      viewer: "maintainer",
      stable: true,
      reviews: {
        totalCount: 4,
        distinctCount: 3,
        countGap: 1,
        records: [
          {
            id: 10,
            backingCommentId: 100,
            body: "Overall finding",
            status: "agreed",
            user: { id: 2, login: "reviewer" },
            commitId: "fixture-commit",
          },
          {
            id: 11,
            unpublished: true,
            backingCommentId: null,
            status: null,
            viewerReactions: null,
          },
          { id: 12, backingCommentId: null, status: null, submittedAt: null, commitId: null },
        ],
      },
      unpublishedInlineComments: [{ id: 301, status: null, viewerReactions: null }],
      issueComments: {
        records: [
          {
            id: 401,
            viewerReactions: ["+1", "-1"],
            status: "in-progress",
            conflictingFinalReactions: true,
          },
        ],
      },
      conversations: [
        {
          anchorId: 201,
          displayLine: 9,
          comments: [
            {
              id: 201,
              kind: "finding",
              user: { id: 2, login: "reviewer" },
              htmlUrl: null,
              resolver: null,
            },
            { id: 202, kind: "finding" },
            { id: 203, kind: "reply", replyTo: 201 },
          ],
        },
      ],
    });
    expect(snapshot.diagnostics).toContain(
      "reviews: X-Total-Count 4 vs 3 distinct visible — a gap of 1 is another user's unpublished draft",
    );
    expect(result.stderr).toBe("");
  });

  it.each([
    ["snapshot", "--repo", "owner/repo", "--pr", "7"],
    ["summary", "--json"],
  ])("shows progress for verbose %s without changing JSON stdout", (...command) => {
    const result = run("stable", ["--verbose", ...command]);
    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stderr).toContain("pass 2:");
  });

  it("reports updatedAt-only drift as valid unstable JSON with exit 3", () => {
    const result = run("updated");
    expect(result.status).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      stable: false,
      issueComments: { records: [{ updatedAt: "2026-01-02T00:00:00Z" }] },
    });
  });

  it.each([
    ["malformed", "Forgejo repos/owner/repo/pulls/7/reviews: expected a JSON array"],
    ["bad-count", "GET repos/owner/repo/pulls/7/reviews: missing or invalid X-Total-Count"],
    [
      "issue-gap",
      "GET repos/owner/repo/issues/7/comments: 1 distinct comment ids vs X-Total-Count 2 — completeness unproven",
    ],
  ])("fails closed without snapshot stdout for %s", (mode, diagnostic) => {
    const result = run(mode);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(diagnostic);
  });

  it("projects same-line findings individually and attaches authenticated marker replies", () => {
    const result = run("stable", ["summary", "--json"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect((JSON.parse(result.stdout) as { items: unknown[] }).items).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 100,
          reviewId: 10,
          actionable: true,
          body: "Overall finding",
        }),
        expect.objectContaining({
          id: null,
          reviewId: 12,
          actionable: false,
          body: "Missing native anchor",
        }),
        expect.objectContaining({
          id: 201,
          body: "First independent finding",
          responses: [expect.objectContaining({ body: "Fixed first" })],
        }),
        expect.objectContaining({ id: 202, body: "Second independent finding", responses: [] }),
        expect.objectContaining({ id: 401, status: "in-progress" }),
      ]),
    );
    expect((JSON.parse(result.stdout) as { items: unknown[] }).items).toHaveLength(5);
  });
});

describe("summary native resolution projection", () => {
  it("keeps resolved findings without a final reaction in-progress", () => {
    const result = run("resolved", ["summary", "--json"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      items: expect.arrayContaining([
        {
          id: 201,
          timestamp: "2026-01-01T00:00:01Z",
          status: "in-progress",
          author: "reviewer",
          location: "src/app.ts:9",
          body: "First independent finding",
          responses: [
            {
              author: "maintainer",
              timestamp: "2026-01-01T00:00:03Z",
              body: "Fixed first",
            },
          ],
        },
      ]) as unknown,
    });
  });
});

describe("standalone explicit repository snapshot", () => {
  it("does not require git or a checkout", () => {
    const result = run("stable", ["snapshot", "--repo", "owner/repo", "--pr", "7"], true);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "pr-feedback.snapshot",
      slug: "owner/repo",
      pr: 7,
      host: "code.j4k.dev",
      viewer: "maintainer",
      stable: true,
    });
    expect(result.stderr).not.toContain("Required dependency 'git'");
  });
});
