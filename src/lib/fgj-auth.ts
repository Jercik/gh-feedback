import { spawnSync } from "node:child_process";
import { forgejoApiHost } from "./forgejo-api-host.js";
import { resolveDependencyPath } from "./resolve-dependency-path.js";
import { ForgejoLogin } from "./forgejo-login.js";

export const FGJ_PATH_ENV_VAR = "PR_FEEDBACK_FGJ_PATH";

export function getFgjBinaryPath(): string {
  return resolveDependencyPath({
    defaultPath: "fgj",
    envOverride: process.env[FGJ_PATH_ENV_VAR],
  });
}

const FGJ_AUTH_USER_MINIMUM_BUILD = "v0.6.1-j4k.4";

function runFgjAuth(subcommand: "token" | "user"): string {
  const fgjPath = getFgjBinaryPath();
  const result = spawnSync(fgjPath, ["auth", subcommand, "--hostname", forgejoApiHost()], {
    encoding: "utf8",
    timeout: 15_000,
  });

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
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `fgj auth ${subcommand} failed`);
  }
  return result.stdout;
}

let cachedToken: string | undefined;

export function fgjToken(): string {
  if (cachedToken) {
    return cachedToken;
  }
  const token = runFgjAuth("token").trim();
  if (!token) {
    throw new Error("Error: fgj auth token returned no token.");
  }
  cachedToken = token;
  return token;
}

let cachedViewer: ForgejoLogin | undefined;

export function getForgejoViewer(): ForgejoLogin {
  if (cachedViewer) {
    return cachedViewer;
  }
  // An fgj without `auth user` prints the auth group's help and exits 0, so only a lone login line counts.
  const stdout = runFgjAuth("user");
  const login = stdout.endsWith("\n") ? ForgejoLogin.safeParse(stdout.slice(0, -1)) : undefined;
  if (!login?.success) {
    throw new Error(
      `Error: installed fgj does not print the stored login with 'fgj auth user'; install the j4k build ${FGJ_AUTH_USER_MINIMUM_BUILD} or newer`,
    );
  }
  cachedViewer = login.data;
  return login.data;
}
