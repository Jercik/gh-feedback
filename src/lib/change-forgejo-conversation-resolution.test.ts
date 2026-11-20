import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { changeForgejoConversationResolution } from "./change-forgejo-conversation-resolution.js";

let fixtureDirectory: string;
beforeAll(() => {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-resolution-"));
  const fgj = path.join(fixtureDirectory, "fgj");
  fs.writeFileSync(fgj, "#!/bin/sh\nexec sleep 60\n", { mode: 0o755 });
  vi.stubEnv("PR_FEEDBACK_FGJ_PATH", fgj);
});
afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

describe("changeForgejoConversationResolution", () => {
  it("fails naming the transition when fgj does not exit", () => {
    expect(() => changeForgejoConversationResolution("owner/repo", 7, 301, "resolve")).toThrow(
      new Error("fgj pr review resolve did not finish within 15 seconds"),
    );
  });
});
