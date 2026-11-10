export const CLAIMS_PAGE_LIMIT = 500;

const REQUEST_TIMEOUT_MS = 20_000;

function fetchFailureReason(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `no response within ${REQUEST_TIMEOUT_MS / 1000} seconds`;
  }
  // Node's fetch rejects with a bare "fetch failed" and puts the network error in its cause.
  if (error instanceof Error && error.cause instanceof Error) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

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
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${options.token}`,
          Accept: "application/json",
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `Review service ${method} ${route} at ${url.origin} failed: ${fetchFailureReason(error)}`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new Error(`Review service ${method} ${route} failed (${response.status})`);
    }
    return response.json();
  };
}
