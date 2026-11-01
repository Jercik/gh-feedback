/**
 * Forgejo REST access layer.
 *
 * fgj is the gh-equivalent CLI but has NO `api` passthrough, so for every
 * endpoint we mint a token with `fgj auth token` and call the REST API
 * directly with fetch. The API host defaults to repoq's canonical FORGEJO_API_HOST
 * (the tailnet SSH alias is never an HTTP host) and can be pointed at another
 * Forgejo instance with PR_FEEDBACK_FORGEJO_API_HOST.
 */

import { spawnSync } from "node:child_process";
import { FORGEJO_API_HOST } from "./provider.js";
import { normalizeForgejoApiHost } from "./normalize-forgejo-api-host.js";
import { resolveDependencyPath } from "./resolve-dependency-path.js";

export const FGJ_PATH_ENV_VAR = "PR_FEEDBACK_FGJ_PATH";
export const FORGEJO_API_HOST_ENV_VAR = "PR_FEEDBACK_FORGEJO_API_HOST";

export function forgejoApiHost(): string {
  const override = process.env[FORGEJO_API_HOST_ENV_VAR]?.trim();
  if (!override) {
    return FORGEJO_API_HOST;
  }
  return normalizeForgejoApiHost(override);
}

export function getFgjBinaryPath(): string {
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
function fgjToken(): string {
  if (cachedToken) {
    return cachedToken;
  }

  const fgjPath = getFgjBinaryPath();
  const result = spawnSync(fgjPath, ["auth", "token", "--hostname", forgejoApiHost()], {
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
    throw new Error(result.stderr.trim() || "fgj auth token failed");
  }

  const token = result.stdout.trim();
  if (!token) {
    throw new Error("Error: fgj auth token returned no token.");
  }

  cachedToken = token;
  return token;
}

interface ForgejoRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path relative to /api/v1, e.g. "repos/owner/repo/pulls". Leading slash optional. */
  path: string;
  /** Query string parameters appended to the URL. */
  query?: Record<string, string | number>;
  /** JSON request body for POST/PATCH. */
  body?: unknown;
}

function buildUrl(path: string, query?: Record<string, string | number>): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`https://${forgejoApiHost()}/api/v1/${normalized}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Indicates an HTTP error from the Forgejo API. Carries the status so callers
 * can distinguish 404 (swallowable) from other failures.
 */
class ForgejoHttpError extends Error {
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

/**
 * Return a successful Forgejo REST response without consuming its body.
 * Throw ForgejoHttpError for non-success HTTP status codes.
 */
export async function forgejoResponse(request: ForgejoRequest): Promise<Response> {
  const token = fgjToken();
  const method = request.method ?? "GET";
  const url = buildUrl(request.path, request.query);

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: "application/json",
  };
  if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(15_000),
    ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ForgejoHttpError(
      response.status,
      `Forgejo ${method} ${request.path} failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return response;
}

/**
 * Parse successful JSON, or return undefined for HTTP 204 or an empty body.
 * T is the caller's assertion of the response shape, not runtime validation.
 */
export async function forgejoFetch<T>(request: ForgejoRequest): Promise<T | undefined> {
  const response = await forgejoResponse(request);
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text) as T;
}
