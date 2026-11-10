import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let directory: string;
let fgj: string;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "dismiss-cli-"));
  fgj = path.join(directory, "fgj");
  fs.writeFileSync(
    fgj,
    [
      "#!/bin/sh",
      'case "$*" in',
      String.raw`  *"pr review"*) printf '{"fgj":"%s"}\n' "$*" >> "$FIXTURE_MUTATION_LOG"; exit 0;;`,
      "esac",
      String.raw`printf '%s\n' fixture-token`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(args: string[], fixtureEnv: Record<string, string> = {}) {
  const mutationLog = path.join(
    directory,
    `mutations-${args.join("-").replaceAll("/", "_")}.jsonl`,
  );
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "dist/cli.js"), ...args, "--repo", "owner/repo", "--pr", "7"],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        ...fixtureEnv,
        FIXTURE_MUTATION_LOG: mutationLog,
        PR_FEEDBACK_FGJ_PATH: fgj,
        PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
        REVIEW_SERVICE_URL: "https://review.example.test",
        REVIEW_CAPABILITY_TOKEN: "fixture-capability",
        NODE_OPTIONS: `--import=${new URL("fixtures/dismiss-api.test.fixture.ts", import.meta.url).href}`,
      },
    },
  );
  const mutations = fs.existsSync(mutationLog)
    ? fs
        .readFileSync(mutationLog, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  return { ...result, mutations };
}

describe("dismiss", () => {
  it("refuses a human comment before any write", () => {
    const result = run(["dismiss", "302", "-m", "Not a defect"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: #302 is not a review-service finding; use 'disagree'.");
    expect(result.mutations).toStrictEqual([]);
  });

  it("replies, records the disposition under the reply's key, then reacts and resolves", () => {
    const result = run(["dismiss", "301", "-m", "Not a defect"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501\n");
    expect(result.mutations).toStrictEqual([
      {
        method: "POST",
        route: "repos/owner/repo/pulls/7/reviews/10/comments",
        body: {
          body: "<!-- gh-feedback:reply-to:301 -->\n\nNot a defect",
          path: "file.ts",
          new_position: 4,
        },
      },
      {
        method: "POST",
        route: "/v1/claims/01M71ZA6QAKR3HA7G41W0553BP/dispositions",
        body: {
          disposition_key: "forgejo:code.j4k.dev:owner/repo:7:outcome:501",
          kind: "dismissed",
          rationale: "Not a defect",
        },
      },
      {
        method: "POST",
        route: "repos/owner/repo/issues/comments/301/reactions",
        body: { content: "hooray" },
      },
      {
        fgj: "--hostname code.j4k.dev pr review resolve 7 301 -R owner/repo --json",
      },
    ]);
  });

  it("--dry-run refuses a finding whose claim path differs in the service", () => {
    const result = run(["dismiss", "305", "-m", "Not a defect", "--dry-run"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Error: The finding's claim and path do not belong to its review.",
    );
    expect(result.mutations).toStrictEqual([]);
  });

  it("--dry-run writes nothing", () => {
    const result = run(["dismiss", "301", "-m", "Not a defect", "--dry-run"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("Dry run: no changes made.\n");
    expect(result.mutations).toStrictEqual([]);
  });
});

describe("dismiss after a later decision", () => {
  it("reports the conflict without advising a rerun", () => {
    const result = run(["dismiss", "301", "-m", "Not a defect"], { FIXTURE_SUPERSEDED: "1" });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      [
        "Warning: Reply posted (https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501) and dismissed recorded with the review service, but a later step failed: disposition was superseded by a later decision; inspect the claim before deciding again",
        "Reply URL: https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501",
        "",
      ].join("\n"),
    );
  });
});

describe("start", () => {
  it("refuses a dismissed item before any write", () => {
    const result = run(["start", "303"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Error: Item #303 is dismissed with the review service. Use 'reopen 303 -m <why>' to reconsider it.",
    );
    expect(result.mutations).toStrictEqual([]);
  });

  it("starts an item that carries a stray hooray but is not a review-service finding", () => {
    const result = run(["start", "304"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.mutations).toStrictEqual([
      {
        method: "DELETE",
        route: "repos/owner/repo/issues/comments/304/reactions",
        body: { content: "hooray" },
      },
      {
        method: "POST",
        route: "repos/owner/repo/issues/comments/304/reactions",
        body: { content: "eyes" },
      },
    ]);
  });
});
