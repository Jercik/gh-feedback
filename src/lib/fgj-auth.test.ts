import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fgjToken } from "./fgj-auth.js";

let fixtureDirectory: string;
beforeAll(() => {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-auth-"));
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(() => {
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

function useFakeFgj(name: string, script: string): void {
  const fgj = path.join(fixtureDirectory, name);
  fs.writeFileSync(fgj, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  vi.stubEnv("PR_FEEDBACK_FGJ_PATH", fgj);
  vi.stubEnv("PR_FEEDBACK_FORGEJO_API_HOST", "code.j4k.dev");
}

describe("fgjToken", () => {
  it("fails naming the fgj command when fgj does not exit", () => {
    useFakeFgj("hanging-fgj", "exec sleep 60");

    expect(() => fgjToken()).toThrow(
      new Error("fgj auth token --hostname code.j4k.dev did not finish within 15 seconds"),
    );
  });

  it("fails naming the fgj command and its exit status when fgj fails silently", () => {
    useFakeFgj("silent-fgj", "exit 3");

    expect(() => fgjToken()).toThrow(new Error("fgj auth token --hostname code.j4k.dev exited 3"));
  });
});
