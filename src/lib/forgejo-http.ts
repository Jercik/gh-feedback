/**
 * Forgejo HTTP transport primitives shared by the REST client (forgejo-cli) and
 * the web-route client (forgejo-web-form).
 *
 * fgj is the gh-equivalent CLI but has NO `api` passthrough, so every request
 * mints a token with `fgj auth token` and calls Forgejo directly with fetch. The
 * API host defaults to repoq's canonical FORGEJO_API_HOST (the tailnet SSH alias
 * is never an HTTP host) and can be pointed at another instance with
 * GH_FEEDBACK_FORGEJO_API_HOST.
 */

import { spawnSync } from "node:child_process";
import { FORGEJO_API_HOST } from "./provider.js";
import { normalizeForgejoApiHost } from "./normalize-forgejo-api-host.js";
import { resolveDependencyPath } from "./resolve-dependency-path.js";

export const FGJ_PATH_ENV_VAR = "GH_FEEDBACK_FGJ_PATH";
export const FORGEJO_API_HOST_ENV_VAR = "GH_FEEDBACK_FORGEJO_API_HOST";

export function forgejoApiHost(): string {
  const override = process.env[FORGEJO_API_HOST_ENV_VAR]?.trim();
  if (!override) {
    return FORGEJO_API_HOST;
  }
  return normalizeForgejoApiHost(override);
}

function getFgjBinaryPath(): string {
  return resolveDependencyPath({
    defaultPath: "fgj",
    envOverride: process.env[FGJ_PATH_ENV_VAR],
  });
}

let cachedToken: string | undefined;

/**
 * Mint a Forgejo API token via `fgj auth token --hostname <host>`.
 * Cached per process since the token is stable for the session.
 */
export function fgjToken(): string {
  if (cachedToken) {
    return cachedToken;
  }

  const fgjPath = getFgjBinaryPath();
  const result = spawnSync(fgjPath, ["auth", "token", "--hostname", forgejoApiHost()], {
    encoding: "utf8",
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
    throw new Error(result.stderr.trim() || "fgj auth token failed");
  }

  const token = result.stdout.trim();
  if (!token) {
    throw new Error("Error: fgj auth token returned no token.");
  }

  cachedToken = token;
  return token;
}

/**
 * Indicates an HTTP error from Forgejo. Carries the status so callers can
 * distinguish 404 (swallowable) from other failures.
 */
export class ForgejoHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ForgejoHttpError";
    this.status = status;
  }
}

export function isForgejoNotFound(error: unknown): boolean {
  return error instanceof ForgejoHttpError && error.status === 404;
}
