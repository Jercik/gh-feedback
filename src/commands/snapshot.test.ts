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
  fs.writeFileSync(
    fgj,
    [
      "#!/bin/sh",
      'case "$1 $2 $FGJ_FIXTURE_USER" in',
      String.raw`  "auth token "*) printf '%s\n' fixture-token;;`,
      // An fgj without `auth user` answers with the auth group's help and exit 0.
      String.raw`  "auth user help") printf '%s\n' 'Manage authentication with Forgejo instances' '' 'Usage:' '  fgj auth [command]' '' 'Available Commands:' '  login       Log in to a Forgejo instance' '  token       Print the auth token';;`,
      String.raw`  "auth user unconfigured") printf '%s\n' 'no user stored for code.j4k.dev; run fgj auth login' >&2; exit 1;;`,
      String.raw`  "auth user "*) printf '%s\n' maintainer;;`,
      "  *) exit 1;;",
      "esac",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
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
  fgjUser = "",
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [path.join(repoRoot, "dist/cli.js"), ...command], {
    cwd: standalone ? os.tmpdir() : checkout,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      ...(standalone ? { PATH: "", PR_FEEDBACK_GIT_PATH: "/no-git-for-explicit-snapshot" } : {}),
      PR_FEEDBACK_FGJ_PATH: fgj,
      FGJ_FIXTURE_USER: fgjUser,
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
            kind: "finding",
            replyTo: null,
            viewerReactions: ["+1", "-1"],
            status: "in-progress",
            conflictingFinalReactions: true,
          },
          {
            id: 402,
            kind: "reply",
            replyTo: 401,
            viewerReactions: null,
            status: null,
            conflictingFinalReactions: false,
          },
          {
            id: 403,
            kind: "finding",
            replyTo: null,
            viewerReactions: ["rocket"],
            status: "acknowledged",
            conflictingFinalReactions: false,
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
      issueComments: {
        records: [{ id: 401, updatedAt: "2026-01-02T00:00:00Z" }, { id: 402 }, { id: 403 }],
      },
    });
  });

  it.each([
    ["malformed", "Forgejo repos/owner/repo/pulls/7/reviews: expected a JSON array"],
    ["bad-count", "GET repos/owner/repo/pulls/7/reviews: missing or invalid X-Total-Count"],
    [
      "issue-gap",
      "GET repos/owner/repo/issues/7/comments: 3 distinct comment ids vs X-Total-Count 4 — completeness unproven",
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
        expect.objectContaining({
          id: 401,
          status: "in-progress",
          responses: [expect.objectContaining({ body: "Which case?" })],
        }),
        expect.objectContaining({
          id: 403,
          status: "acknowledged",
          body: "> Replying to review comment #301\n\nStill a draft",
        }),
      ]),
    );
    expect((JSON.parse(result.stdout) as { items: unknown[] }).items).toHaveLength(6);
  });
});

describe("detail", () => {
  it("lists the viewer's PR comment reply on the comment it answers, reading no other comment's reactions", () => {
    const result = run("detail-401", ["detail", "401", "--json"]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
      type: "comment",
      id: 401,
      author: "reviewer",
      url: "https://code.j4k.dev/owner/repo/pulls/7#issuecomment-401",
      createdAt: "2026-01-01T00:00:04Z",
      body: "Issue finding",
      reactions: [
        { content: "+1", count: 1, viewerHasReacted: false, users: ["maintainer"] },
        { content: "-1", count: 1, viewerHasReacted: false, users: ["maintainer"] },
        { content: "rocket", count: 1, viewerHasReacted: false, users: ["reviewer"] },
      ],
      prCommentReplies: [
        {
          id: 402,
          author: "maintainer",
          createdAt: "2026-01-01T00:00:05Z",
          body: "Which case?",
        },
      ],
    });
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

  it("reads a summary with an explicit target and no git", () => {
    const result = run("stable", ["summary", "--repo", "owner/repo", "--pr", "7", "--json"], true);
    expect(result.status).toBe(0);
    const summary: unknown = JSON.parse(result.stdout);
    expect(summary).toHaveProperty("items");
    expect(result.stderr).not.toContain("Required dependency 'git'");
  });

  it("rejects an invalid target before reading the message", () => {
    const result = run(
      "stable",
      ["agree", "401", "-f", "/missing-message-file", "--repo", "owner/repo"],
      true,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--repo requires --pr");
    expect(result.stderr).not.toContain("Error reading file");
  });

  it("rejects --repo without --pr", () => {
    const result = run("stable", ["ack", "401", "--repo", "owner/repo", "--dry-run"], true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--repo requires --pr");
  });
});

describe("viewer login from fgj", () => {
  it("names the minimum fgj build when fgj answers auth user with help text", () => {
    const result = run("stable", ["snapshot", "--repo", "owner/repo", "--pr", "7"], false, "help");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Error: installed fgj does not print the stored login with 'fgj auth user'; install the j4k build v0.6.1-j4k.4 or newer",
    );
  });

  it("fails with fgj's message when fgj auth user exits nonzero", () => {
    const result = run(
      "stable",
      ["snapshot", "--repo", "owner/repo", "--pr", "7"],
      false,
      "unconfigured",
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("no user stored for code.j4k.dev; run fgj auth login");
  });
});
