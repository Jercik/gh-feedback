/**
 * Forgejo REST access layer: typed helpers over the /api/v1 endpoints. Transport
 * primitives (host resolution, token minting, the error type) live in
 * forgejo-http; this module builds request URLs and parses JSON responses.
 */

import { ForgejoHttpError, fgjToken, forgejoApiHost } from "./forgejo-http.js";

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
