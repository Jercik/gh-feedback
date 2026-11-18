/**
 * Forgejo REST access layer.
 *
 * Every endpoint is called in-process with fetch, using a token from
 * `fgj auth token`, rather than through `fgj api`: callers then read the HTTP
 * status (isForgejoNotFound) and headers (X-Total-Count) as values instead of
 * parsing them from a subprocess's output.
 */

import { fgjToken } from "./fgj-auth.js";
import { forgejoApiHost } from "./forgejo-api-host.js";

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
