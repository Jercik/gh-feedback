import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let checkout: string;
let fgj: string;
beforeAll(() => {
  checkout = fs.mkdtempSync(path.join(os.tmpdir(), "completion-cli-"));
  fgj = path.join(checkout, "fgj");
  fs.writeFileSync(
    fgj,
    "#!/bin/sh\nif [ \"$1\" = auth ]; then printf '%s\\n' fixture-token; else printf '%s\\n' 'unknown command \"resolve\"' >&2; exit 1; fi\n",
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
});
afterAll(() => {
  fs.rmSync(checkout, { recursive: true, force: true });
});

function run(id: string) {
  return spawnSync(process.execPath, [path.join(repoRoot, "dist/cli.js"), "ack", id], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      PR_FEEDBACK_FGJ_PATH: fgj,
      PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
      NODE_OPTIONS: `--import=${new URL("fixtures/completion-api.test.fixture.ts", import.meta.url).href}`,
    },
  });
}

describe("ack completion output", () => {
  it("acknowledges an issue comment without printing anything", () => {
    const result = run("401");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("reports when the installed fgj cannot resolve conversations", () => {
    const result = run("201");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Note: conversation resolution skipped - installed fgj does not support conversation resolution; install the j4k build v0.5.0-j4k.4 or newer",
    );
  });
});
