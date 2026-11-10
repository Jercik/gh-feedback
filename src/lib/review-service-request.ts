export const CLAIMS_PAGE_LIMIT = 500;

export function createServiceRequest(options: {
  serviceUrl: string;
  token: string;
}): (
  method: "GET" | "POST",
  route: string,
  query: Record<string, string>,
  body?: object,
) => Promise<unknown> {
  return async (method, route, query, body) => {
    const url = new URL(route, options.serviceUrl);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Review service ${method} ${route} failed (${response.status})`);
    }
    return response.json();
  };
}
