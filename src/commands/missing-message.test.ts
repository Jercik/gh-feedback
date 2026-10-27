import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cliPath = path.join(repoRoot, "dist/cli.js");

let checkout: string;

beforeAll(() => {
  // Spawning the compiled CLI is the only way to observe the real stdin behavior.
  execFileSync(path.join(repoRoot, "node_modules/.bin/tsc"), ["-p", "tsconfig.build.json"], {
    cwd: repoRoot,
  });
  checkout = fs.mkdtempSync(path.join(os.tmpdir(), "gh-feedback-test-"));
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: checkout });
  };
  git("init", "--quiet");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("remote", "add", "origin", "https://code.j4k.dev/j4k-oss/example.git");
}, 120_000);

afterAll(() => {
  fs.rmSync(checkout, { recursive: true, force: true });
});

interface RunResult {
  code: number | null;
  stderr: string;
  timedOut: boolean;
}

// Stdin stays an open pipe that never sends EOF, like an agent's shell.
function runWithOpenStdin(args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: checkout,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    let timedOut = false;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 10_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, timedOut });
    });
  });
}

describe("reply commands without a message", () => {
  it.each(["agree", "disagree", "ask"])(
    "%s fails at once with a usage error while stdin stays open",
    async (command) => {
      const result = await runWithOpenStdin([command, "123"]);

      expect(result.timedOut).toBe(false);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("-m/--message");
    },
  );

  it("rejects an empty -m instead of falling back to stdin", async () => {
    const result = await runWithOpenStdin(["agree", "123", "-m", ""]);

    expect(result.timedOut).toBe(false);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Empty reply message");
  });
});
