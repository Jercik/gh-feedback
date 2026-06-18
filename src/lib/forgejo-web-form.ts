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
 *
 * `redirect: "manual"` is load-bearing: if token auth ever stops being accepted,
 * the web auth chain answers with a 302 to /user/login (verifyAuthWithOptions),
 * and fetch would otherwise follow it to the login page's 200 and report success
 * on an unresolved conversation. Treating any 3xx as failure closes that hole.
 */

import { ForgejoHttpError, fgjToken, forgejoApiHost } from "./forgejo-http.js";

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
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new ForgejoHttpError(
      response.status,
      `Forgejo POST /${normalized} redirected (${response.status}, Location: ${response.headers.get("location") ?? "?"}); token auth was likely rejected by the web route.`,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ForgejoHttpError(
      response.status,
      `Forgejo POST /${normalized} failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }
}
