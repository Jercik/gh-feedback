/**
 * Normalize the GH_FEEDBACK_FORGEJO_API_HOST override to a bare host[:port].
 *
 * The documented form is a bare host, but a value carrying a scheme (e.g.
 * `https://code.j4k.dev`) would otherwise be interpolated into `https://https://…`,
 * which `new URL` silently parses to the wrong host. Accept a full URL or a bare
 * host and return just the host so an accidental scheme is forgiven.
 */
export function normalizeForgejoApiHost(raw: string): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(raw);
  return new URL(hasScheme ? raw : `https://${raw}`).host;
}
