/**
 * Detect which forge backs the current repository from its origin remote.
 *
 * github.com               -> github  (gh + GraphQL backend)
 * code.j4k.dev | code.tail.j4k.dev -> forgejo (fgj token + REST /api/v1)
 * anything else            -> unknown (callers must reject)
 *
 * The slug (owner/repo) differs per forge: the Forge typically drops the
 * `j4k-` affix, so it must be derived from each origin and never reused across
 * providers.
 */

type Provider = "github" | "forgejo";

interface ProviderInfo {
  readonly provider: Provider;
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  /** owner/repo as it exists on this forge */
  readonly slug: string;
}

const FORGEJO_HOSTS = new Set(["code.j4k.dev", "code.tail.j4k.dev"]);

/**
 * The API host is ALWAYS code.j4k.dev: fgj auto-detect fails on the tailnet
 * SSH origin, and the REST API is only served from the canonical host.
 */
export const FORGEJO_API_HOST = "code.j4k.dev";

/**
 * Extract the host from a git remote URL.
 *
 * Handles the three origin shapes that appear in practice:
 *   https://host/owner/repo.git
 *   ssh://user@host:2222/owner/repo.git
 *   user@host:owner/repo.git  (scp-like)
 */
function extractHost(remoteUrl: string): string | undefined {
  const url = remoteUrl.trim();

  const schemeMatch = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]+@)?([^/:]+)/iu.exec(url);
  if (schemeMatch?.[1]) {
    return schemeMatch[1].toLowerCase();
  }

  const scpMatch = /^(?:[^@]+@)?([^/:]+):/u.exec(url);
  if (scpMatch?.[1]) {
    return scpMatch[1].toLowerCase();
  }

  return undefined;
}

/**
 * Extract owner/repo from a git remote URL: the last two path segments with a
 * trailing `.git` stripped.
 */
function extractSlug(remoteUrl: string): { owner: string; repo: string } | undefined {
  const withoutGit = remoteUrl.trim().replace(/\.git$/u, "");
  const match = /[/:]([^/:]+)\/([^/]+)$/u.exec(withoutGit);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return { owner: match[1], repo: match[2] };
}

function hostToProvider(host: string): Provider | undefined {
  if (host === "github.com") {
    return "github";
  }
  if (FORGEJO_HOSTS.has(host)) {
    return "forgejo";
  }
  return undefined;
}

/**
 * Parse a git origin URL into provider, host, and slug. Returns undefined when
 * the host is unrecognized so callers can reject with a clear message.
 */
export function detectProvider(remoteUrl: string): ProviderInfo | undefined {
  const host = extractHost(remoteUrl);
  if (!host) {
    return undefined;
  }

  const provider = hostToProvider(host);
  if (!provider) {
    return undefined;
  }

  const slug = extractSlug(remoteUrl);
  if (!slug) {
    return undefined;
  }

  return {
    provider,
    host,
    owner: slug.owner,
    repo: slug.repo,
    slug: `${slug.owner}/${slug.repo}`,
  };
}
