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

function run(mode: string, env: Record<string, string | undefined> = {}): SpawnSyncReturns<string> {
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
        ...env,
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

describe("review CLI failures", () => {
  it("names the review service and the network error when the service is unreachable", () => {
    const result = run("unreachable");
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Review service GET /v1/reviews/01M71ZA6QAKR3HA7G41W0553BN/passes at https://review.example.test failed: getaddrinfo ENOTFOUND review.example.test",
    );
  });

  it("names every address's network error when a host with several addresses is unreachable", () => {
    const result = run("unreachable-addresses");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Review service GET /v1/reviews/01M71ZA6QAKR3HA7G41W0553BN/passes at https://review.example.test failed: connect ECONNREFUSED ::1:443; connect ECONNREFUSED 127.0.0.1:443",
    );
  });

  it("names a malformed credential file without quoting it", () => {
    const home = path.join(directory, "home");
    for (const config of [path.join(home, "Library/Preferences"), path.join(home, "config")]) {
      const file = path.join(config, "j4k-review/repos/code.j4k.dev/owner/repo.json");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        '{"serviceUrl": "https://review.example.test", "capabilityToken": SECRET',
        {
          mode: 0o600,
        },
      );
    }

    const result = run("stamped", {
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, "config"),
      REVIEW_SERVICE_URL: undefined,
      REVIEW_CAPABILITY_TOKEN: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      '/j4k-review/repos/code.j4k.dev/owner/repo.json is not valid: expected JSON {"serviceUrl": "...", "capabilityToken": "..."}',
    );
    expect(result.stderr).not.toContain("SECRET");
  });
});
