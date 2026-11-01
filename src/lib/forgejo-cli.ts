import { forgejoFetch } from "./forgejo-http.js";
import { fetchPaginatedListing } from "./forgejo-review-pages.js";

export {
  FGJ_PATH_ENV_VAR,
  FORGEJO_API_HOST_ENV_VAR,
  forgejoApiHost,
  getFgjBinaryPath,
  isForgejoNotFound,
  forgejoFetch,
  forgejoResponse,
} from "./forgejo-http.js";

export async function forgejoFetchReviews(path: string): Promise<unknown[]> {
  const listing = await fetchPaginatedListing(path);
  return listing.items;
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

/** Fetch a counted, paginated collection; full-set routes use forgejoFetchList. */
export async function forgejoFetchAll<T>(
  path: string,
  query: Record<string, string | number> = {},
): Promise<T[]> {
  const listing = await fetchPaginatedListing(path, undefined, query);
  return listing.items as T[];
}
