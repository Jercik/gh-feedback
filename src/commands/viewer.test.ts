import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let directory: string;
let fgj: string;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "viewer-cli-"));
  fgj = path.join(directory, "fgj");
  fs.writeFileSync(
    fgj,
    [
      "#!/bin/sh",
      'case "$1 $2" in',
      String.raw`  "auth token") printf '%s\n' fixture-token;;`,
      String.raw`  "auth user") printf '%s\n' maintainer;;`,
      "  *) exit 1;;",
      "esac",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(command: string[]): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [path.join(repoRoot, "dist/cli.js"), ...command, "--repo", "owner/repo", "--pr", "7"],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        PR_FEEDBACK_FGJ_PATH: fgj,
        PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
        NODE_OPTIONS: `--import=${new URL("fixtures/two-viewers-api.test.fixture.ts", import.meta.url).href}`,
      },
    },
  );
}

const maintainerSnapshot = {
  schema: "pr-feedback.snapshot",
  version: 1,
  host: "code.j4k.dev",
  slug: "owner/repo",
  pr: 7,
  viewer: "maintainer",
  limit: 50,
  stable: true,
  diagnostics: [],
  reviews: {
    totalCount: 2,
    distinctCount: 2,
    countGap: 0,
    records: [
      {
        id: 10,
        state: "COMMENT",
        unpublished: false,
        user: { id: 2, login: "reviewer" },
        body: "Overall finding",
        submittedAt: "2026-01-01T00:00:00Z",
        commitId: "fixture-commit",
        htmlUrl: "https://code.j4k.dev/owner/repo/pulls/7#issuecomment-100",
        backingCommentId: 100,
        viewerReactions: ["+1"],
        status: "agreed",
        conflictingFinalReactions: false,
      },
      {
        id: 11,
        state: "PENDING",
        unpublished: true,
        user: { id: 1, login: "maintainer" },
        body: "Private draft",
        submittedAt: null,
        commitId: null,
        htmlUrl: "https://code.j4k.dev/owner/repo/pulls/7",
        backingCommentId: null,
        viewerReactions: null,
        status: null,
        conflictingFinalReactions: false,
      },
    ],
  },
  issueComments: {
    totalCount: 3,
    records: [
      {
        id: 401,
        user: { id: 2, login: "reviewer" },
        body: "Issue finding",
        createdAt: "2026-01-01T00:00:04Z",
        updatedAt: "2026-01-01T00:00:04Z",
        htmlUrl: null,
        viewerReactions: ["confused"],
        status: "awaiting-reply",
        conflictingFinalReactions: false,
      },
      {
        id: 402,
        user: { id: 1, login: "maintainer" },
        body: "> Replying to comment #401\n\nWhich case?",
        createdAt: "2026-01-01T00:00:05Z",
        updatedAt: "2026-01-01T00:00:05Z",
        htmlUrl: null,
        viewerReactions: [],
        status: "pending",
        conflictingFinalReactions: false,
      },
      {
        id: 403,
        user: { id: 3, login: "colleague" },
        body: "> Replying to comment #401\n\nThe empty one",
        createdAt: "2026-01-01T00:00:06Z",
        updatedAt: "2026-01-01T00:00:06Z",
        htmlUrl: null,
        viewerReactions: [],
        status: "pending",
        conflictingFinalReactions: false,
      },
    ],
  },
  conversations: [
    {
      reviewId: 10,
      path: "src/app.ts",
      side: "new",
      displayLine: 9,
      anchorId: 201,
      resolver: null,
      comments: [
        {
          id: 201,
          kind: "finding",
          replyTo: null,
          user: { id: 2, login: "reviewer" },
          body: "Inline finding",
          createdAt: "2026-01-01T00:00:01Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: ["rocket"],
          status: "acknowledged",
          conflictingFinalReactions: false,
        },
        {
          id: 202,
          kind: "reply",
          replyTo: 201,
          user: { id: 1, login: "maintainer" },
          body: "<!-- gh-feedback:reply-to:201 -->\nFixed in abc123",
          createdAt: "2026-01-01T00:00:02Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: null,
          status: null,
          conflictingFinalReactions: false,
        },
        {
          id: 203,
          kind: "finding",
          replyTo: null,
          user: { id: 3, login: "colleague" },
          body: "<!-- gh-feedback:reply-to:201 -->\nStill reproduces for me",
          createdAt: "2026-01-01T00:00:03Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: [],
          status: "pending",
          conflictingFinalReactions: false,
        },
      ],
    },
  ],
  unpublishedInlineComments: [
    {
      id: 301,
      kind: "finding",
      replyTo: null,
      user: { id: 1, login: "maintainer" },
      body: "Draft inline",
      createdAt: null,
      path: "draft.ts",
      position: 4,
      originalPosition: 0,
      extraLinesCount: 0,
      side: "new",
      displayLine: 4,
      pullRequestReviewId: 11,
      htmlUrl: null,
      resolver: null,
      viewerReactions: null,
      status: null,
      conflictingFinalReactions: false,
    },
  ],
  pull: {
    number: 7,
    html_url: "https://code.j4k.dev/owner/repo/pulls/7",
    state: "open",
    title: "Fixture PR",
    body: "",
    head: { ref: "fixture", sha: "head-sha", repo: { full_name: "owner/repo" } },
  },
};

const colleagueSnapshot = {
  schema: "pr-feedback.snapshot",
  version: 1,
  host: "code.j4k.dev",
  slug: "owner/repo",
  pr: 7,
  viewer: "colleague",
  limit: 50,
  stable: true,
  diagnostics: [],
  reviews: {
    totalCount: 2,
    distinctCount: 2,
    countGap: 0,
    records: [
      {
        id: 10,
        state: "COMMENT",
        unpublished: false,
        user: { id: 2, login: "reviewer" },
        body: "Overall finding",
        submittedAt: "2026-01-01T00:00:00Z",
        commitId: "fixture-commit",
        htmlUrl: "https://code.j4k.dev/owner/repo/pulls/7#issuecomment-100",
        backingCommentId: 100,
        viewerReactions: ["-1"],
        status: "disagreed",
        conflictingFinalReactions: false,
      },
      {
        id: 11,
        state: "PENDING",
        unpublished: true,
        user: { id: 1, login: "maintainer" },
        body: "Private draft",
        submittedAt: null,
        commitId: null,
        htmlUrl: "https://code.j4k.dev/owner/repo/pulls/7",
        backingCommentId: null,
        viewerReactions: null,
        status: null,
        conflictingFinalReactions: false,
      },
    ],
  },
  issueComments: {
    totalCount: 3,
    records: [
      {
        id: 401,
        user: { id: 2, login: "reviewer" },
        body: "Issue finding",
        createdAt: "2026-01-01T00:00:04Z",
        updatedAt: "2026-01-01T00:00:04Z",
        htmlUrl: null,
        viewerReactions: ["+1"],
        status: "agreed",
        conflictingFinalReactions: false,
      },
      {
        id: 402,
        user: { id: 1, login: "maintainer" },
        body: "> Replying to comment #401\n\nWhich case?",
        createdAt: "2026-01-01T00:00:05Z",
        updatedAt: "2026-01-01T00:00:05Z",
        htmlUrl: null,
        viewerReactions: [],
        status: "pending",
        conflictingFinalReactions: false,
      },
      {
        id: 403,
        user: { id: 3, login: "colleague" },
        body: "> Replying to comment #401\n\nThe empty one",
        createdAt: "2026-01-01T00:00:06Z",
        updatedAt: "2026-01-01T00:00:06Z",
        htmlUrl: null,
        viewerReactions: [],
        status: "pending",
        conflictingFinalReactions: false,
      },
    ],
  },
  conversations: [
    {
      reviewId: 10,
      path: "src/app.ts",
      side: "new",
      displayLine: 9,
      anchorId: 201,
      resolver: null,
      comments: [
        {
          id: 201,
          kind: "finding",
          replyTo: null,
          user: { id: 2, login: "reviewer" },
          body: "Inline finding",
          createdAt: "2026-01-01T00:00:01Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: ["eyes"],
          status: "in-progress",
          conflictingFinalReactions: false,
        },
        {
          id: 202,
          kind: "finding",
          replyTo: null,
          user: { id: 1, login: "maintainer" },
          body: "<!-- gh-feedback:reply-to:201 -->\nFixed in abc123",
          createdAt: "2026-01-01T00:00:02Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: [],
          status: "pending",
          conflictingFinalReactions: false,
        },
        {
          id: 203,
          kind: "reply",
          replyTo: 201,
          user: { id: 3, login: "colleague" },
          body: "<!-- gh-feedback:reply-to:201 -->\nStill reproduces for me",
          createdAt: "2026-01-01T00:00:03Z",
          path: "src/app.ts",
          position: 9,
          originalPosition: 0,
          extraLinesCount: 0,
          side: "new",
          displayLine: 9,
          pullRequestReviewId: 10,
          htmlUrl: null,
          resolver: null,
          viewerReactions: null,
          status: null,
          conflictingFinalReactions: false,
        },
      ],
    },
  ],
  unpublishedInlineComments: [
    {
      id: 301,
      kind: "finding",
      replyTo: null,
      user: { id: 1, login: "maintainer" },
      body: "Draft inline",
      createdAt: null,
      path: "draft.ts",
      position: 4,
      originalPosition: 0,
      extraLinesCount: 0,
      side: "new",
      displayLine: 4,
      pullRequestReviewId: 11,
      htmlUrl: null,
      resolver: null,
      viewerReactions: null,
      status: null,
      conflictingFinalReactions: false,
    },
  ],
  pull: {
    number: 7,
    html_url: "https://code.j4k.dev/owner/repo/pulls/7",
    state: "open",
    title: "Fixture PR",
    body: "",
    head: { ref: "fixture", sha: "head-sha", repo: { full_name: "owner/repo" } },
  },
};

const maintainerSummary = {
  prNumber: 7,
  prUrl: "https://code.j4k.dev/owner/repo/pulls/7",
  prTitle: "Fixture PR",
  items: [
    {
      id: 100,
      actionable: true,
      reviewId: 10,
      timestamp: "2026-01-01T00:00:00Z",
      status: "agreed",
      author: "reviewer",
      location: "",
      body: "Overall finding",
      responses: [],
    },
    {
      id: 201,
      timestamp: "2026-01-01T00:00:01Z",
      status: "acknowledged",
      author: "reviewer",
      location: "src/app.ts:9",
      body: "Inline finding",
      responses: [
        { author: "maintainer", timestamp: "2026-01-01T00:00:02Z", body: "Fixed in abc123" },
      ],
    },
    {
      id: 203,
      timestamp: "2026-01-01T00:00:03Z",
      status: "pending",
      author: "colleague",
      location: "src/app.ts:9",
      body: "<!-- gh-feedback:reply-to:201 -->\nStill reproduces for me",
      responses: [],
    },
    {
      id: 401,
      timestamp: "2026-01-01T00:00:04Z",
      status: "awaiting-reply",
      author: "reviewer",
      location: "",
      body: "Issue finding",
      responses: [],
    },
    {
      id: 403,
      timestamp: "2026-01-01T00:00:06Z",
      status: "pending",
      author: "colleague",
      location: "",
      body: "> Replying to comment #401\n\nThe empty one",
      responses: [],
    },
  ],
};

const colleagueSummary = {
  prNumber: 7,
  prUrl: "https://code.j4k.dev/owner/repo/pulls/7",
  prTitle: "Fixture PR",
  items: [
    {
      id: 100,
      actionable: true,
      reviewId: 10,
      timestamp: "2026-01-01T00:00:00Z",
      status: "disagreed",
      author: "reviewer",
      location: "",
      body: "Overall finding",
      responses: [],
    },
    {
      id: 201,
      timestamp: "2026-01-01T00:00:01Z",
      status: "in-progress",
      author: "reviewer",
      location: "src/app.ts:9",
      body: "Inline finding",
      responses: [
        { author: "colleague", timestamp: "2026-01-01T00:00:03Z", body: "Still reproduces for me" },
      ],
    },
    {
      id: 202,
      timestamp: "2026-01-01T00:00:02Z",
      status: "pending",
      author: "maintainer",
      location: "src/app.ts:9",
      body: "<!-- gh-feedback:reply-to:201 -->\nFixed in abc123",
      responses: [],
    },
    {
      id: 401,
      timestamp: "2026-01-01T00:00:04Z",
      status: "agreed",
      author: "reviewer",
      location: "",
      body: "Issue finding",
      responses: [],
    },
    {
      id: 402,
      timestamp: "2026-01-01T00:00:05Z",
      status: "pending",
      author: "maintainer",
      location: "",
      body: "> Replying to comment #401\n\nWhich case?",
      responses: [],
    },
  ],
};

describe("reading a pull request two accounts reacted and replied on", () => {
  it.each([
    ["the fgj login by default", [], maintainerSnapshot],
    ["--viewer maintainer", ["--viewer", "maintainer"], maintainerSnapshot],
    ["--viewer colleague", ["--viewer", "colleague"], colleagueSnapshot],
  ])("snapshot reports it as %s settled it", (_label, viewer, expected) => {
    const result = run(["snapshot", ...viewer]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual(expected);
  });

  it.each([
    ["the fgj login by default", [], maintainerSummary],
    ["--viewer colleague", ["--viewer", "colleague"], colleagueSummary],
  ])("summary reports it as %s settled it", (_label, viewer, expected) => {
    const result = run(["summary", "--json", ...viewer]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual(expected);
  });
});

describe("--viewer usage", () => {
  it.each(["snapshot", "summary"])("%s rejects a value that is not a Forgejo login", (command) => {
    const result = run([command, "--viewer", "-bad--login-"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "error: option '--viewer <login>' argument '-bad--login-' is invalid. Not a valid Forgejo login.\n(add --help for additional information)\n",
    );
  });

  it.each([
    ["ack", "401"],
    ["start", "401"],
    ["reply", "401", "-m", "Noted"],
  ])("%s does not take --viewer", (...command) => {
    const result = run([...command, "--viewer", "colleague"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: unknown option '--viewer'");
  });
});
