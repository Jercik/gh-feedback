import { forgejoFetch, forgejoResponse } from "./forgejo-http.js";

export async function fetchReviewListing(
  path: string,
  suppliedLimit?: number,
): Promise<{ items: unknown[]; totalCount: number; limit: number }> {
  const settings =
    suppliedLimit === undefined
      ? await forgejoFetch<{ max_response_items: unknown }>({ path: "settings/api" })
      : { max_response_items: suppliedLimit };
  const limit = settings.max_response_items;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Forgejo settings/api: invalid max_response_items");
  }
  const all: unknown[] = [];
  let totalCount = 0;
  // Pending reviews are hidden after database pagination, so even an empty page is not EOF.
  for (let page = 1; page <= 1000; page += 1) {
    const response = await forgejoResponse({ path, query: { page, limit } });
    const header = response.headers.get("X-Total-Count");
    if (header === null || !/^\d+$/u.test(header) || !Number.isSafeInteger(Number(header))) {
      throw new Error(`Forgejo ${path}: missing or invalid X-Total-Count`);
    }
    totalCount = Math.max(totalCount, Number(header));
    const items: unknown = await response.json();
    if (!Array.isArray(items)) {
      throw new TypeError(`Forgejo ${path}: expected a review array`);
    }
    all.push(...items);
    if (page >= Math.ceil(totalCount / limit)) {
      return { items: all, totalCount, limit };
    }
  }
  throw new Error(`Forgejo ${path}: review pagination exceeded 1000 pages`);
}
