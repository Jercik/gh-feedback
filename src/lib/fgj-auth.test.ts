import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fgjToken } from "./fgj-auth.js";

let fixtureDirectory: string;
beforeAll(() => {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-auth-"));
  const fgj = path.join(fixtureDirectory, "fgj");
  fs.writeFileSync(fgj, "#!/bin/sh\nexec sleep 60\n", { mode: 0o755 });
  vi.stubEnv("PR_FEEDBACK_FGJ_PATH", fgj);
  vi.stubEnv("PR_FEEDBACK_FORGEJO_API_HOST", "code.j4k.dev");
});
afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

describe("fgjToken", () => {
  it("fails naming the fgj command when fgj does not exit", () => {
    expect(() => fgjToken()).toThrow(
      new Error("fgj auth token --hostname code.j4k.dev did not finish within 15 seconds"),
    );
  });
});
