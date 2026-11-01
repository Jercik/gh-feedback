import { forgejoFetch, forgejoResponse } from "./forgejo-http.js";

export async function fetchPaginatedListing(
  path: string,
  suppliedLimit?: number,
  query: Record<string, string | number> = {},
): Promise<{ items: unknown[]; totalCount: number; limit: number }> {
  const limit = suppliedLimit === undefined ? await fetchApiLimit() : parseApiLimit(suppliedLimit);
  const all: unknown[] = [];
  let totalCount = 0;
  // Pending reviews are hidden after database pagination, so even an empty page is not EOF.
  for (let page = 1; page <= 1000; page += 1) {
    const response = await forgejoResponse({ path, query: { ...query, page, limit } });
    totalCount = Math.max(totalCount, requireTotalCount(response, path));
    const items: unknown = await response.json();
    if (!Array.isArray(items)) {
      throw new TypeError(`Forgejo ${path}: expected a JSON array`);
    }
    all.push(...items);
    if (page >= Math.ceil(totalCount / limit)) {
      return { items: all, totalCount, limit };
    }
  }
  throw new Error(`Forgejo ${path}: pagination exceeded 1000 pages`);
}

function parseApiLimit(limit: unknown): number {
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("GET settings/api: invalid max_response_items");
  }
  return limit;
}

export async function fetchApiLimit(): Promise<number> {
  const settings = await forgejoFetch<unknown>({ path: "settings/api" });
  return parseApiLimit(
    typeof settings === "object" && settings !== null && "max_response_items" in settings
      ? settings.max_response_items
      : undefined,
  );
}

export function requireTotalCount(response: Response, path: string): number {
  const value = response.headers.get("X-Total-Count");
  if (value === null || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`GET ${path}: missing or invalid X-Total-Count`);
  }
  return Number(value);
}
