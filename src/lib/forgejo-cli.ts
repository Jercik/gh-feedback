/**
 * Forgejo REST access layer.
 *
 * fgj is the gh-equivalent CLI but has NO `api` passthrough, so for every
 * endpoint we mint a token with `fgj auth token` and call the REST API
 * directly with fetch. The API host defaults to repoq's canonical FORGEJO_API_HOST
 * (the tailnet SSH alias is never an HTTP host) and can be pointed at another
 * Forgejo instance with GH_FEEDBACK_FORGEJO_API_HOST.
 */

import { spawnSync } from "node:child_process";
import { FORGEJO_API_HOST } from "./provider.js";
import { normalizeForgejoApiHost } from "./normalize-forgejo-api-host.js";
import { resolveDependencyPath } from "./resolve-dependency-path.js";

export const FGJ_PATH_ENV_VAR = "GH_FEEDBACK_FGJ_PATH";
export const FORGEJO_API_HOST_ENV_VAR = "GH_FEEDBACK_FORGEJO_API_HOST";

function forgejoApiHost(): string {
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
function fgjToken(): string {
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
 * Call the Forgejo REST API and return the parsed JSON body.
 * Generic is return-only so callers supply the expected shape.
 */
export async function forgejoFetch<T>(request: ForgejoRequest): Promise<T> {
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
    ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ForgejoHttpError(
      response.status,
      `Forgejo ${method} ${request.path} failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

/**
 * POST an application/x-www-form-urlencoded request to a Forgejo *web* route
 * (outside /api/v1). The reviews API has no resolve endpoint, so resolving a
 * conversation must drive the same web handler the "Resolve conversation" button
 * hits. Two facts make this callable without a browser session:
 *   - Auth: the web auth chain's OAuth2 method accepts `Authorization: token
 *     <sha>`, so the same minted API token authenticates a web route.
 *   - CSRF: Forgejo guards web routes with Go's net/http CrossOriginProtection,
 *     which allows any request carrying neither Sec-Fetch-Site nor Origin (i.e. a
 *     non-browser client) — so no CSRF token is needed, and we send neither header.
 */
export async function forgejoWebForm(
  routePath: string,
  form: Record<string, string>,
): Promise<void> {
  const token = fgjToken();
  const normalized = routePath.startsWith("/") ? routePath.slice(1) : routePath;
  const url = `https://${forgejoApiHost()}/${normalized}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: new URLSearchParams(form).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ForgejoHttpError(
      response.status,
      `Forgejo POST /${normalized} failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }
}

/**
 * Fetch a Forgejo collection endpoint that returns its whole set in one
 * response and ignores page/limit (e.g. issues/{index}/comments and
 * reviews/{id}/comments, which have no ListOptions). With no ListOptions the
 * DB query applies no LIMIT and returns every row regardless of count — the
 * MAX_RESPONSE_ITEMS cap only bounds endpoints that opt into paging, so the
 * full set comes back even past 50 items. forgejoFetchAll must NOT be used on
 * these: once the set reaches the page size, every page returns everything, so
 * it would loop forever accumulating duplicates.
 */
export async function forgejoFetchList<T>(
  path: string,
  query: Record<string, string | number> = {},
): Promise<T[]> {
  const items = await forgejoFetch<T[]>({ path, query });
  return Array.isArray(items) ? items : [];
}

/**
 * Fetch every page of a genuinely paginated Forgejo collection endpoint (one
 * that honors page/limit, e.g. pulls and pulls/{index}/reviews). Stops when a
 * page returns fewer than `limit` items. For full-set endpoints that ignore
 * pagination, use forgejoFetchList instead.
 */
export async function forgejoFetchAll<T>(
  path: string,
  query: Record<string, string | number> = {},
  limit = 50,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  for (;;) {
    const items = await forgejoFetch<T[]>({
      path,
      query: { ...query, page, limit },
    });
    if (!Array.isArray(items) || items.length === 0) {
      break;
    }
    all.push(...items);
    if (items.length < limit) {
      break;
    }
    page += 1;
  }

  return all;
}
