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
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "review-cli-"));
  fgj = path.join(directory, "fgj");
  fs.writeFileSync(fgj, "#!/bin/sh\nprintf '%s\\n' fixture-token\n", { mode: 0o755 });
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(mode: string): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [path.join(repoRoot, "dist/cli.js"), "review", "--repo", "owner/repo", "--pr", "7"],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        PR_FEEDBACK_FGJ_PATH: fgj,
        PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
        REVIEW_SERVICE_URL: "https://review.example.test",
        REVIEW_CAPABILITY_TOKEN: "fixture-capability",
        REVIEW_FIXTURE_MODE: mode,
        NODE_OPTIONS: `--import=${new URL("fixtures/review-api.test.fixture.ts", import.meta.url).href}`,
      },
    },
  );
}

describe("compiled review CLI", () => {
  it("prints the stamped summary's review facts", () => {
    const result = run("stamped");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
      schema: "pr-feedback.review",
      version: 1,
      host: "code.j4k.dev",
      slug: "owner/repo",
      pr: 7,
      summary: {
        commentId: 6,
        updatedAt: "2026-11-10T05:36:22Z",
        stamp: {
          reviewId: "01M71ZA6QAKR3HA7G41W0553BN",
          head: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      },
      review: {
        id: "01M71ZA6QAKR3HA7G41W0553BN",
        pass: {
          state: "sealed",
          id: "NEW",
          sealedAt: "2026-11-10T05:36:45.478Z",
          complete: true,
          slots: [
            {
              lens: "general-bug",
              part: "whole",
              arm: "default",
              unitStatus: "no-claims",
              completedWithLoss: false,
            },
          ],
        },
        claims: {
          unadjudicated: [
            { id: "C1", severity: "high", title: "Title C1", path: "src/a.ts" },
            { id: "C2", severity: "high", title: "Title C2", path: null },
          ],
          ungrounded: [],
          groundingPending: [],
        },
      },
    });
  });

  it("prints null summary and review without calling the service when no summary exists", () => {
    const result = run("no-summary");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ summary: null, review: null });
  });
});
