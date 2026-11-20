import { spawnSync } from "node:child_process";
import { resolveDependencyPath } from "./resolve-dependency-path.js";

export const FGJ_PATH_ENV_VAR = "PR_FEEDBACK_FGJ_PATH";

const FGJ_TIMEOUT_MS = 15_000;

interface FgjExit {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export function runFgj(args: string[]): FgjExit {
  const fgjPath = resolveDependencyPath({
    defaultPath: "fgj",
    envOverride: process.env[FGJ_PATH_ENV_VAR],
  });
  const result = spawnSync(fgjPath, args, { encoding: "utf8", timeout: FGJ_TIMEOUT_MS });

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(
        `Error: Required dependency 'fgj' not found.\n` +
          `Looked for: ${fgjPath}\n` +
          `To fix, either:\n` +
          `  1. Install the Forgejo CLI (fgj)\n` +
          `  2. Set ${FGJ_PATH_ENV_VAR}=/path/to/fgj`,
      );
    }
    if (error.code === "ETIMEDOUT") {
      throw new Error(
        `fgj ${args.join(" ")} did not finish within ${FGJ_TIMEOUT_MS / 1000} seconds`,
      );
    }
    throw result.error;
  }

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
