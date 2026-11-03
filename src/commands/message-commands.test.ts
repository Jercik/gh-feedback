import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let checkout: string;
let fgj: string;
beforeAll(() => {
  checkout = fs.mkdtempSync(path.join(os.tmpdir(), "message-commands-"));
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
});
afterAll(() => {
  fs.rmSync(checkout, { recursive: true, force: true });
});

function run(args: string[]) {
  const mutationLog = path.join(checkout, `mutations-${args.join("-")}.jsonl`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "dist/cli.js"), ...args], {
    cwd: checkout,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...process.env,
      FIXTURE_MUTATION_LOG: mutationLog,
      PR_FEEDBACK_FGJ_PATH: fgj,
      PR_FEEDBACK_FORGEJO_API_HOST: "code.j4k.dev",
      NODE_OPTIONS: `--import=${new URL("fixtures/message-commands-api.test.fixture.ts", import.meta.url).href}`,
    },
  });
  const mutations = fs.existsSync(mutationLog)
    ? fs
        .readFileSync(mutationLog, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  return { ...result, mutations };
}

const replyPost = {
  method: "POST",
  route: "repos/owner/repo/issues/7/comments",
  body: { body: "> Replying to comment #401\n\nNoted" },
};

describe("message commands on a pending issue comment", () => {
  it.each([
    [
      "agree",
      [
        replyPost,
        {
          method: "POST",
          route: "repos/owner/repo/issues/comments/401/reactions",
          body: { content: "+1" },
        },
      ],
    ],
    [
      "disagree",
      [
        replyPost,
        {
          method: "POST",
          route: "repos/owner/repo/issues/comments/401/reactions",
          body: { content: "-1" },
        },
      ],
    ],
    [
      "ask",
      [
        replyPost,
        {
          method: "POST",
          route: "repos/owner/repo/issues/comments/401/reactions",
          body: { content: "confused" },
        },
      ],
    ],
    ["reply", [replyPost]],
  ])("%s posts its reply and status reaction and prints the reply URL", (command, expected) => {
    const result = run([command, "401", "-m", "Noted"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501\n");
    expect(result.mutations).toStrictEqual(expected);
  });

  it.each(["agree", "disagree", "ask", "reply"])("%s --dry-run changes nothing", (command) => {
    const result = run([command, "401", "-m", "Noted", "--dry-run"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Dry run: no changes made.\n");
    expect(result.mutations).toStrictEqual([]);
  });
});

describe("message commands on an agreed issue comment", () => {
  it.each([
    ["agree", ["agree", "402", "-m", "Noted"]],
    ["disagree", ["disagree", "402", "-m", "Noted"]],
    ["ask", ["ask", "402", "-m", "Noted"]],
    ["ack", ["ack", "402"]],
  ])("%s refuses the item and changes nothing", (_command, argv) => {
    const result = run(argv);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Error: Item #402 is already "agreed".`);
    expect(result.mutations).toStrictEqual([]);
  });

  it("reply posts the reply without touching reactions", () => {
    const result = run(["reply", "402", "-m", "Noted"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501\n");
    expect(result.mutations).toStrictEqual([
      {
        method: "POST",
        route: "repos/owner/repo/issues/7/comments",
        body: { body: "> Replying to comment #402\n\nNoted" },
      },
    ]);
  });
});

describe("message commands whose status reaction fails", () => {
  it.each([
    ["agree", "Warning: Reply posted, but status update failed: "],
    ["disagree", "Warning: Reply posted, but status update failed: "],
    ["ask", "Warning: Question posted, but status update failed: "],
  ])("%s exits 1 and reports the posted reply on stderr", (command, warning) => {
    const result = run([command, "403", "-m", "Noted"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(warning);
    expect(result.stderr).toContain(
      "Reply URL: https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501\n",
    );
  });
});
